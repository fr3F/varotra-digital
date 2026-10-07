import type { Repositories } from '../db/repositories.ts';
import { type NotificationDetails, notificationText } from '../domain/facebook-templates.ts';
import type { MessageKind, NotificationEvent, OutgoingReply, ReplyRecord } from '../domain/types.ts';
import type { MessengerClient } from './messenger-client.ts';

/** Fenêtre standard de Messenger : la Page peut écrire librement 24 h après le dernier message du client. */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NotifyResult =
  | { readonly delivered: true; readonly text: string }
  | {
      readonly delivered: false;
      readonly reason: 'OUTSIDE_WINDOW' | 'SEND_FAILED' | 'UNKNOWN_ORDER';
      readonly text: string | null;
    };

interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/**
 * Service notification Facebook : tout message envoyé à un client passe par ici
 * (envoi via l'API Messenger, règle des 24 h, journal = historique des réponses).
 */
export function createFacebookNotificationService(deps: {
  readonly repos: Repositories;
  readonly client: MessengerClient;
  readonly logger: Logger;
  readonly now?: () => Date;
}) {
  const { repos, client, logger } = deps;
  const now = deps.now ?? (() => new Date());

  /** Envoie et journalise. Renvoie false si Meta a refusé l'envoi. */
  async function send(psid: string, reply: OutgoingReply, meta: { draftId?: string; kind?: MessageKind } = {}) {
    try {
      await client.sendText(psid, reply.text, reply.quickReplies);
      await repos.outgoing.log({ psid, ...reply, ...meta, status: client.live ? 'SENT' : 'SIMULATED' });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await repos.outgoing.log({ psid, ...reply, ...meta, status: 'FAILED', error: message });
      logger.error(`Envoi Messenger impossible à ${psid} : ${message}`);
      return false;
    }
  }

  return {
    send,

    /**
     * Prévient le client d'un événement de sa commande (confirmation, indisponibilité, livraison…).
     * Seulement dans les 24 h suivant son dernier message : hors fenêtre, rien n'est envoyé
     * (Meta refuse les « message tags » de suivi depuis le 27/04/2026) et l'échec est journalisé.
     */
    async notify(draftId: string, event: NotificationEvent, details: NotificationDetails = {}): Promise<NotifyResult> {
      const draft = await repos.drafts.findById(draftId);
      if (draft === null) {
        return { delivered: false, reason: 'UNKNOWN_ORDER', text: null };
      }
      const conversation = await repos.conversations.find(draft.psid);
      // Message dans la langue de la conversation du client.
      const text = notificationText(event, draft, details, conversation?.state.lang);
      // Le statut vu par le client suit la décision du vendeur, même si le message ne peut pas partir.
      await repos.drafts.setCustomerStatus(draft.id, event);

      const lastMessage = conversation?.lastCustomerMessageAt ?? null;
      if (lastMessage === null || now().getTime() - Date.parse(lastMessage) > MESSAGING_WINDOW_MS) {
        await repos.outgoing.log({ psid: draft.psid, text, status: 'OUTSIDE_WINDOW', draftId: draft.id, kind: event });
        return { delivered: false, reason: 'OUTSIDE_WINDOW', text };
      }
      const sent = await send(draft.psid, { text }, { draftId: draft.id, kind: event });
      logger.info(`Commande ${draft.reference} : client prévenu (${event}) — ${sent ? 'envoyé' : 'échec'}.`);
      return sent ? { delivered: true, text } : { delivered: false, reason: 'SEND_FAILED', text };
    },

    /**
     * Message écrit par le vendeur dans l'application, envoyé tel quel au client de la commande.
     * Même règle des 24 h que les notifications : hors fenêtre, rien n'est envoyé.
     */
    async sendManual(draftId: string, text: string): Promise<NotifyResult> {
      const draft = await repos.drafts.findById(draftId);
      if (draft === null) {
        return { delivered: false, reason: 'UNKNOWN_ORDER', text: null };
      }
      const conversation = await repos.conversations.find(draft.psid);
      const lastMessage = conversation?.lastCustomerMessageAt ?? null;
      if (lastMessage === null || now().getTime() - Date.parse(lastMessage) > MESSAGING_WINDOW_MS) {
        await repos.outgoing.log({ psid: draft.psid, text, status: 'OUTSIDE_WINDOW', draftId: draft.id, kind: 'MANUAL' });
        return { delivered: false, reason: 'OUTSIDE_WINDOW', text };
      }
      const sent = await send(draft.psid, { text }, { draftId: draft.id, kind: 'MANUAL' });
      logger.info(`Commande ${draft.reference} : message du vendeur — ${sent ? 'envoyé' : 'échec'}.`);
      return sent ? { delivered: true, text } : { delivered: false, reason: 'SEND_FAILED', text };
    },

    /** Historique des réponses envoyées pour une commande (accusé, confirmations, indisponibilités…). */
    history(draftId: string): Promise<ReplyRecord[]> {
      return repos.outgoing.findByDraft(draftId);
    },
  };
}

export type FacebookNotificationService = ReturnType<typeof createFacebookNotificationService>;
