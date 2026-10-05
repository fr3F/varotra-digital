import { database } from '@/database/database';
import { messengerReplyRepository } from '@/database/repositories/messenger-reply.repository';
import { CUSTOMER_REPLY_KINDS, CustomerReply, CustomerReplyEntry, CustomerReplyKind, Order, OrderStatus, UnavailableItem } from '@/models';
import { messengerOutboxVersion, messengerStore } from './messenger-state';

/**
 * Réponses Facebook côté application : met une réponse en file d'envoi (elle part dès que le réseau
 * le permet, via le backend) et expose l'historique. Ne dépend pas de OrderService.
 */
export const facebookReplyService = {
  /**
   * Programme une réponse pour une commande Messenger. Respecte les réglages : « Réponse automatique »
   * pour les réponses automatiques, « Prévenir le client » pour les changements de statut manuels.
   * À appeler dans la transaction qui modifie la commande.
   */
  async queue(
    order: Order,
    kind: CustomerReplyKind,
    options: { readonly automatic: boolean; readonly unavailable?: readonly UnavailableItem[] },
  ): Promise<boolean> {
    const settings = messengerStore.get();
    const allowed = options.automatic ? settings.autoReply : settings.notifyCustomer;
    if (order.source !== 'MESSENGER' || order.externalRef === null || !allowed) {
      return false;
    }
    await messengerReplyRepository.enqueue({
      orderId: order.id,
      externalRef: order.externalRef,
      kind,
      automatic: options.automatic,
      unavailable: options.unavailable,
    });
    database.afterCommit(() => messengerOutboxVersion.set((version) => version + 1));
    return true;
  },

  /** Changement de statut par le vendeur (ou validation automatique) : réponse correspondante. */
  queueForStatus(order: Order, status: OrderStatus, automatic: boolean): Promise<boolean> {
    const kind = CUSTOMER_REPLY_KINDS.find((candidate) => candidate === status);
    return kind === undefined ? Promise.resolve(false) : facebookReplyService.queue(order, kind, { automatic });
  },

  history(orderId: string): Promise<CustomerReply[]> {
    return messengerReplyRepository.findByOrder(orderId);
  },

  recent(): Promise<CustomerReplyEntry[]> {
    return messengerReplyRepository.findRecent();
  },
};
