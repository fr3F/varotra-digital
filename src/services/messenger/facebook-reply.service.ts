import { database } from '@/database/database';
import { messengerReplyRepository } from '@/database/repositories/messenger-reply.repository';
import { CUSTOMER_REPLY_KINDS, CustomerReply, CustomerReplyEntry, CustomerReplyKind, Order, OrderStatus, UnavailableItem } from '@/models';
import { ValidationError } from '@/core/errors/app-error';
import { messengerOutboxVersion, messengerStore } from './messenger-state';

/** Limite Messenger pour un message texte. */
const MAX_MESSAGE_LENGTH = 2000;

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

  /**
   * Message écrit par le vendeur pour le client d'une commande Messenger : mis en file, il part
   * aussitôt (ou dès le retour du réseau). Toujours envoyé, quels que soient les réglages.
   */
  async sendMessage(order: Order, text: string): Promise<void> {
    const message = text.trim();
    if (order.source !== 'MESSENGER' || order.externalRef === null) {
      throw new ValidationError('Seules les commandes reçues via Messenger peuvent recevoir un message.');
    }
    if (message.length === 0 || message.length > MAX_MESSAGE_LENGTH) {
      throw new ValidationError('Écrivez un message (2 000 caractères au maximum).');
    }
    await messengerReplyRepository.enqueue({
      orderId: order.id,
      externalRef: order.externalRef,
      kind: 'MANUAL',
      automatic: false,
      messageText: message,
    });
    messengerOutboxVersion.set((version) => version + 1);
  },

  /**
   * Frais de livraison convenus pour une commande Messenger : le client les reçoit avec le total.
   * Toujours envoyé. À appeler dans la transaction qui enregistre les frais.
   */
  async queueDeliveryFee(order: Order, fee: number): Promise<boolean> {
    if (order.source !== 'MESSENGER' || order.externalRef === null) {
      return false;
    }
    await messengerReplyRepository.enqueue({
      orderId: order.id,
      externalRef: order.externalRef,
      kind: 'DELIVERY_FEE',
      automatic: false,
      deliveryFee: fee,
    });
    database.afterCommit(() => messengerOutboxVersion.set((version) => version + 1));
    return true;
  },

  history(orderId: string): Promise<CustomerReply[]> {
    return messengerReplyRepository.findByOrder(orderId);
  },

  recent(): Promise<CustomerReplyEntry[]> {
    return messengerReplyRepository.findRecent();
  },
};
