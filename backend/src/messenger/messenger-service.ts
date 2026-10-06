import type { Repositories } from '../db/repositories.ts';
import { confirmationReply, handleMessage, PAYLOADS } from '../domain/conversation-engine.ts';
import { isStatusInquiry, statusInquiryText } from '../domain/facebook-templates.ts';
import { detectLanguage, MESSAGES } from '../domain/i18n.ts';
import { INITIAL_CONVERSATION } from '../domain/types.ts';
import type { OrderPushService } from '../push/order-push.service.ts';
import type { FacebookNotificationService } from './facebook-notification.service.ts';
import type { MessengerClient } from './messenger-client.ts';
import type { MessengerEvent } from './webhook-events.ts';

interface Logger {
  info(message: string): void;
  error(message: string): void;
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
        const state = existing?.state ?? INITIAL_CONVERSATION;
        const lastCustomerMessageAt = new Date(event.timestamp).toISOString();

        // « Statut ? », « ma commande » : où en est la dernière commande (hors panier en cours).
        const latest = await repos.drafts.findLatestByPsid(event.psid);
        if (event.message.kind === 'TEXT' && latest !== null && state.cart.length === 0 && isStatusInquiry(event.message.text)) {
          const lang = detectLanguage(event.message.text) ?? state.lang;
          await repos.conversations.save({ psid: event.psid, customerName, state: { ...state, lang }, lastCustomerMessageAt });
          await notifications.send(
            event.psid,
            {
              text: statusInquiryText(latest, lang),
              quickReplies: [{ title: MESSAGES[lang].buttons.newOrder, payload: PAYLOADS.menu }],
            },
            { draftId: latest.id, kind: 'STATUS_REPLY' },
          );
          await repos.inboundEvents.markProcessed(event.eventId, null);
          return;
        }

        const result = handleMessage(state, event.message, { catalog: await repos.catalog.findAll(), customerName });
        await repos.conversations.save({ psid: event.psid, customerName, state: result.state, lastCustomerMessageAt });

        for (const reply of result.replies) {
          await notifications.send(event.psid, reply);
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
