import { ValidationError } from '@/core/errors/app-error';
import { createEntityStore, loadInto } from '@/core/state/entity-state';
import { database } from '@/database/database';
import { clientRepository } from '@/database/repositories/client.repository';
import { orderStatusHistoryRepository } from '@/database/repositories/order-status-history.repository';
import { orderRepository } from '@/database/repositories/order.repository';
import {
  canTransition,
  EntityId,
  IsoDateString,
  isOrderDeletable,
  isOrderEditable,
  Order,
  OrderDelivery,
  OrderDetail,
  OrderDraft,
  OrderInput,
  OrderLineDraft,
  OrderStatus,
  OrderSummary,
  ORDER_STATUS_LABELS,
} from '@/models';
import { parseDeliveryFee } from '@/utils/money.utils';
import { computeOrderTotal, orderItemService } from './order-item.service';
import { facebookReplyService } from './messenger/facebook-reply.service';
import { notificationService } from './notifications/notification.service';
import { referencePrefix } from './product-lines';
import { productService } from './product.service';
import { saleService } from './sale.service';
import { stockService } from './stock.service';

/** Origine d'une commande reçue via Messenger (import depuis le backend). */
export interface ImportedOrderOrigin {
  readonly externalRef: string;
  readonly customerMessage: string | null;
  readonly needsReview: boolean;
  readonly orderedAt: IsoDateString;
  /** Téléphone, adresse et frais annoncés par le bot. */
  readonly delivery: OrderDelivery | null;
}

/** État réactif partagé de la liste des commandes. */
export const orderStore = createEntityStore<OrderSummary>();

function toInput(order: Order): OrderInput {
  return {
    reference: order.reference,
    clientId: order.clientId,
    status: order.status,
    source: order.source,
    externalRef: order.externalRef,
    totalAmount: order.totalAmount,
    stockReserved: order.stockReserved,
    stockCheck: order.stockCheck,
    customerMessage: order.customerMessage,
    needsReview: order.needsReview,
    notes: order.notes,
    orderedAt: order.orderedAt,
    delivery: order.delivery,
  };
}

/** Référence lisible et unique : CMD-20261002-001. */
async function nextReference(date: Date): Promise<string> {
  const prefix = referencePrefix('CMD', date);
  const count = await orderRepository.countReferences(prefix);
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

/** Vérifie que le client existe et renvoie son nom (null : commande sans client). */
async function clientNameOf(clientId: EntityId | null): Promise<string | null> {
  return clientId === null ? null : (await clientRepository.getById(clientId)).name;
}

async function refreshStores(): Promise<void> {
  await Promise.all([orderService.load(), productService.load()]);
}

/**
 * Cycle de vie des commandes. Les effets sur le stock sont délégués à StockService
 * et exécutés dans la même transaction que le changement de statut.
 */
export const orderService = {
  load(): Promise<void> {
    return loadInto(orderStore, () => orderRepository.findSummaries());
  },

  async getDetail(id: EntityId): Promise<OrderDetail> {
    const order = await orderRepository.getById(id);
    const [client, lines, history] = await Promise.all([
      order.clientId === null ? Promise.resolve(null) : clientRepository.findById(order.clientId),
      orderItemService.listDetails(id),
      orderStatusHistoryRepository.findByOrder(id),
    ]);
    // Seules les commandes pas encore validées peuvent manquer de stock (sinon il est réservé).
    const shortages = isOrderEditable(order.status)
      ? await stockService.findOrderShortages(orderItemService.toStockLines(lines.map((line) => line.item)))
      : [];
    return { order, client, lines, history, shortages };
  },

  /**
   * Ramène chaque ligne à la quantité réellement disponible (lignes épuisées retirées),
   * pour pouvoir valider la commande. Le client est prévenu à la validation.
   */
  async adjustToAvailableStock(id: EntityId): Promise<Order> {
    const current = await orderRepository.getById(id);
    const items = await orderItemService.listByOrder(id);
    const shortages = await stockService.findOrderShortages(orderItemService.toStockLines(items));
    const remaining = new Map(shortages.map((shortage) => [shortage.productId, shortage.available]));
    const lines: OrderLineDraft[] = [];
    for (const item of items) {
      const left = remaining.get(item.productId);
      const quantity = left === undefined ? item.quantity : Math.min(item.quantity, left);
      if (left !== undefined) {
        remaining.set(item.productId, left - quantity);
      }
      if (quantity > 0) {
        lines.push({ productId: item.productId, quantity, unitPrice: item.unitPrice });
      }
    }
    if (lines.length === 0) {
      throw new ValidationError('Aucun produit de cette commande n’est disponible : ajoutez du stock ou annulez-la.');
    }
    return orderService.update(id, { clientId: current.clientId, notes: current.notes, lines });
  },

  /**
   * Crée la commande au statut « Nouvelle ». Le stock n'est réservé qu'à la validation.
   * `origin` : commande reçue via Messenger (référence externe, message du client) ; son stock est
   * vérifié automatiquement et elle peut arriver sans produit (« à vérifier »).
   */
  async create(draft: OrderDraft, origin?: ImportedOrderOrigin): Promise<Order> {
    const lines = orderItemService.validateLines(draft.lines, origin !== undefined);
    const order = await database.transaction(async (tx) => {
      const clientName = await clientNameOf(draft.clientId);
      const now = new Date();
      const stockCheck = origin === undefined ? 'UNCHECKED' : await stockService.checkAvailability(lines);
      const created = await orderRepository.create(
        {
          reference: await nextReference(now),
          clientId: draft.clientId,
          status: 'NEW',
          source: origin === undefined ? 'MANUAL' : 'MESSENGER',
          externalRef: origin?.externalRef ?? null,
          totalAmount: computeOrderTotal(lines),
          stockReserved: false,
          stockCheck,
          customerMessage: origin?.customerMessage ?? null,
          needsReview: origin !== undefined && (origin.needsReview || lines.length === 0),
          notes: draft.notes,
          orderedAt: origin?.orderedAt ?? now.toISOString(),
          delivery: origin?.delivery ?? null,
        },
        tx,
      );
      await orderItemService.replaceForOrder(created.id, lines, origin !== undefined);
      await orderStatusHistoryRepository.create(
        { orderId: created.id, fromStatus: null, toStatus: 'NEW', note: null },
        tx,
      );
      notificationService.notifyNewOrder(created, clientName);
      return created;
    });
    await orderService.load();
    return order;
  },

  /** Modifie client, notes et lignes. Interdit une fois la commande validée (stock réservé). */
  async update(id: EntityId, draft: OrderDraft): Promise<Order> {
    const lines = orderItemService.validateLines(draft.lines);
    const order = await database.transaction(async (tx) => {
      const current = await orderRepository.getById(id, tx);
      if (!isOrderEditable(current.status)) {
        throw new ValidationError(
          `Une commande « ${ORDER_STATUS_LABELS[current.status]} » ne peut plus être modifiée. Remettez-la en préparation d'abord.`,
        );
      }
      await clientNameOf(draft.clientId);
      await orderItemService.replaceForOrder(id, lines);
      return orderRepository.update(
        id,
        {
          ...toInput(current),
          clientId: draft.clientId,
          notes: draft.notes,
          totalAmount: computeOrderTotal(lines),
          // Le vendeur a relu et corrigé la commande ; le stock est revérifié pour une commande Messenger.
          needsReview: false,
          stockCheck:
            current.source === 'MESSENGER' ? await stockService.checkAvailability(lines) : current.stockCheck,
        },
        tx,
      );
    });
    await orderService.load();
    return order;
  },

  /**
   * Change le statut en appliquant les règles de stock :
   * - vers CONFIRMED : vérifie la disponibilité et réserve les quantités ;
   * - CONFIRMED vers PREPARING ou CANCELLED : libère la réservation ;
   * - CONFIRMED vers DELIVERED : la réservation devient une sortie de stock.
   */
  async changeStatus(
    id: EntityId,
    target: OrderStatus,
    note: string | null = null,
    options: { readonly automaticReply?: boolean } = {},
  ): Promise<Order> {
    const order = await database.transaction(async (tx) => {
      const current = await orderRepository.getById(id, tx);
      if (!canTransition(current.status, target)) {
        throw new ValidationError(
          `Impossible de passer de « ${ORDER_STATUS_LABELS[current.status]} » à « ${ORDER_STATUS_LABELS[target]} ».`,
        );
      }
      const items = await orderItemService.listByOrder(id);
      const stockLines = orderItemService.toStockLines(items);
      let stockReserved = current.stockReserved;

      if (target === 'CONFIRMED') {
        if (stockLines.length === 0) {
          throw new ValidationError('La commande ne contient aucun produit.');
        }
        await stockService.reserveForOrder(stockLines);
        stockReserved = true;
      } else if (target === 'DELIVERED') {
        await stockService.fulfillOrder(id, current.reference, stockLines);
        stockReserved = false;
      } else if (current.stockReserved) {
        await stockService.releaseForOrder(stockLines);
        stockReserved = false;
      }

      const updated = await orderRepository.update(id, { ...toInput(current), status: target, stockReserved }, tx);
      await orderStatusHistoryRepository.create(
        { orderId: id, fromStatus: current.status, toStatus: target, note },
        tx,
      );
      // Commande Messenger : le client reçoit la réponse correspondante (via le backend).
      await facebookReplyService.queueForStatus(updated, target, options.automaticReply === true);
      if (target === 'DELIVERED') {
        // La commande livrée devient une vente : elle compte dans le chiffre d'affaires et le bénéfice.
        await saleService.recordFromOrder(updated, items);
        notificationService.notifyOrderCompleted(updated, await clientNameOf(updated.clientId).catch(() => null));
      }
      return updated;
    });
    await refreshStores();
    return order;
  },

  /**
   * Frais de livraison convenus avec le client (commande hors Antananarivo, frais « à convenir ») :
   * enregistrés sur la commande et, pour une commande Messenger, envoyés au client avec le total.
   */
  async setDeliveryFee(id: EntityId, value: string): Promise<Order> {
    const fee = parseDeliveryFee(value);
    if (fee === null) {
      throw new ValidationError('Frais de livraison : montant entre 0 et 1 000 000 Ar.');
    }
    const order = await database.transaction(async (tx) => {
      const current = await orderRepository.getById(id, tx);
      if (current.delivery === null) {
        throw new ValidationError('Cette commande n’a pas de livraison.');
      }
      const updated = await orderRepository.update(id, { ...toInput(current), delivery: { ...current.delivery, fee } }, tx);
      await facebookReplyService.queueDeliveryFee(updated, fee);
      return updated;
    });
    await refreshStores();
    return order;
  },

  /** Supprime la commande (logiquement) et libère son éventuelle réservation. */
  async remove(id: EntityId): Promise<void> {
    await database.transaction(async (tx) => {
      const current = await orderRepository.getById(id, tx);
      if (!isOrderDeletable(current.status)) {
        throw new ValidationError('Une commande livrée ne peut pas être supprimée : elle reste dans l’historique.');
      }
      if (current.stockReserved) {
        await stockService.releaseForOrder(orderItemService.toStockLines(await orderItemService.listByOrder(id)));
      }
      await orderItemService.removeForOrder(id);
      await orderRepository.softDelete(id, tx);
    });
    await refreshStores();
  },

};
