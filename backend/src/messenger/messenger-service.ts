import type { Repositories } from '../db/repositories.ts';
import { confirmationReply, handleMessage, PAYLOADS } from '../domain/conversation-engine.ts';
import { isStatusInquiry, statusInquiryText } from '../domain/facebook-templates.ts';
import { detectLanguage, MESSAGES } from '../domain/i18n.ts';
import { choiceFromText, choicesOf, withNumberedChoices } from '../domain/numbered-choices.ts';
import { INITIAL_CONVERSATION, type OutgoingReply } from '../domain/types.ts';
import type { OrderPushService } from '../push/order-push.service.ts';
import type { FacebookNotificationService } from './facebook-notification.service.ts';
import type { MessengerClient } from './messenger-client.ts';
import type { MessengerEvent } from './webhook-events.ts';

interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/** Un panier sans nouvelles depuis 24 h est oublié : le client repart d'une conversation neuve. */
const STALE_CART_MS = 24 * 60 * 60 * 1000;

/** Produits mis en avant (⭐) : les plus commandés sur Messenger ces 30 derniers jours. */
export const POPULAR_COUNT = 3;
const POPULARITY_DAYS = 30;

export function popularitySince(now: Date = new Date()): string {
  return new Date(now.getTime() - POPULARITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Conversation avec les clients : messages reçus → panier → commande, avec les réponses du bot. */
export function createMessengerService(deps: {
  readonly repos: Repositories;
  readonly client: MessengerClient;
  readonly notifications: FacebookNotificationService;
  readonly orderPush: OrderPushService;
  readonly logger: Logger;
}) {
  const { repos, client, notifications, orderPush, logger } = deps;

  return {
    /**
     * Traite un message client : fait avancer la conversation, crée la commande si le client valide,
     * puis répond. Un événement déjà reçu (webhook renvoyé par Meta) est ignoré.
     */
    async handleEvent(event: MessengerEvent): Promise<void> {
      const content = event.message.kind === 'TEXT' ? event.message.text : 'payload' in event.message ? event.message.payload : null;
      if (!(await repos.inboundEvents.register(event.eventId, event.psid, event.message.kind, content))) {
        return;
      }
      try {
        const existing = await repos.conversations.find(event.psid);
        const customerName = existing?.customerName ?? (await client.getCustomerName(event.psid));
        const stale =
          existing?.lastCustomerMessageAt != null && event.timestamp - Date.parse(existing.lastCustomerMessageAt) > STALE_CART_MS;
        const state = existing === null ? INITIAL_CONVERSATION : stale ? { ...INITIAL_CONVERSATION, lang: existing.state.lang } : existing.state;
        const lastCustomerMessageAt = new Date(event.timestamp).toISOString();

        // « Statut ? », « ma commande » : où en est la dernière commande (hors panier en cours).
        const latest = await repos.drafts.findLatestByPsid(event.psid);
        if (event.message.kind === 'TEXT' && latest !== null && state.cart.length === 0 && isStatusInquiry(event.message.text)) {
          const lang = detectLanguage(event.message.text) ?? state.lang;
          const reply: OutgoingReply = {
            text: statusInquiryText(latest, lang),
            quickReplies: [{ title: MESSAGES[lang].buttons.newOrder, payload: PAYLOADS.menu }],
          };
          await repos.conversations.save({
            psid: event.psid,
            customerName,
            state: { ...state, lang, choices: choicesOf([reply]) },
            lastCustomerMessageAt,
          });
          await notifications.send(event.psid, withNumberedChoices(reply, lang), { draftId: latest.id, kind: 'STATUS_REPLY' });
          await repos.inboundEvents.markProcessed(event.eventId, null);
          return;
        }

        // « 2 » en réponse à une liste numérotée : même effet qu'un appui sur le 2e bouton.
        const choice = event.message.kind === 'TEXT' ? choiceFromText(event.message.text, state.choices) : null;
        const message = choice === null ? event.message : ({ kind: 'POSTBACK', payload: choice } as const);
        const result = handleMessage(state, message, {
          catalog: await repos.catalog.findAll(),
          customerName,
          popularIds: await repos.drafts.popularProductIds(popularitySince(), POPULAR_COUNT),
          lastOrderItems: latest?.items ?? [],
          customerProductIds: await repos.drafts.productIdsOrderedBy(event.psid),
          deliveryFee: await repos.settings.deliveryFee(),
        });
        const nextState = { ...result.state, choices: choicesOf(result.replies) };
        await repos.conversations.save({ psid: event.psid, customerName, state: nextState, lastCustomerMessageAt });

        for (const reply of result.replies) {
          await notifications.send(event.psid, withNumberedChoices(reply, nextState.lang));
        }
        if (result.order !== undefined) {
          const draft = await repos.drafts.create({ psid: event.psid, customerName, ...result.order });
          logger.info(`Commande Messenger ${draft.reference} créée (${draft.items.length} ligne(s), mode ${draft.mode}).`);
          // Le vendeur d'abord : la notification part même si la réponse Messenger échoue ensuite.
          await orderPush.notifyNewOrder(draft);
          await notifications.send(event.psid, confirmationReply(draft, result.state.lang), { draftId: draft.id, kind: 'RECEIPT' });
        }
        await repos.inboundEvents.markProcessed(event.eventId, null);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await repos.inboundEvents.markProcessed(event.eventId, message);
        logger.error(`Traitement de l'événement ${event.eventId} impossible : ${message}`);
      }
    },
  };
}

export type MessengerService = ReturnType<typeof createMessengerService>;

/**
 * File de traitement (Node et tests) : les tâches s'exécutent une par une, dans l'ordre d'arrivée,
 * même entre deux webhooks. Sur Cloudflare, `waitUntil` remplace cette file.
 */
export function createTaskQueue() {
  let chain: Promise<void> = Promise.resolve();
  return {
    push(task: () => Promise<void>): void {
      chain = chain.then(task).catch((error: unknown) => console.error('[Carnet] Tâche en échec', error));
    },
    /** Attend la fin des traitements en cours (tests, arrêt propre du serveur). */
    idle(): Promise<void> {
      return chain;
    },
  };
}
