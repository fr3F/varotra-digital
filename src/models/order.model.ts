import { BaseEntity, EntityId, EntityInput, IsoDateString, Money } from './base.model';
import type { Client } from './client.model';

export const ORDER_STATUSES = ['NEW', 'PREPARING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  NEW: 'Nouvelle',
  PREPARING: 'Préparation',
  CONFIRMED: 'Confirmée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

/** Origine de la commande : saisie manuelle ou reçue via Messenger. */
export const ORDER_SOURCES = ['MANUAL', 'MESSENGER'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const STOCK_CHECKS = ['UNCHECKED', 'OK', 'SHORTAGE'] as const;
export type StockCheck = (typeof STOCK_CHECKS)[number];

/**
 * Transitions autorisées. CONFIRMED réserve le stock, DELIVERED le sort définitivement,
 * CANCELLED libère la réservation. DELIVERED et CANCELLED sont définitifs.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  NEW: ['PREPARING', 'CONFIRMED', 'CANCELLED'],
  PREPARING: ['NEW', 'CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DELIVERED', 'PREPARING', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Commandes encore à traiter (affichées sur le tableau de bord). */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = ['NEW', 'PREPARING', 'CONFIRMED'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Les lignes ne sont modifiables qu'avant la validation (aucun stock réservé). */
export function isOrderEditable(status: OrderStatus): boolean {
  return status === 'NEW' || status === 'PREPARING';
}

/** Une commande livrée a fait sortir du stock : elle est conservée pour l'historique. */
export function isOrderDeletable(status: OrderStatus): boolean {
  return status !== 'DELIVERED';
}

/** TANA : frais fixe annoncé au client ; OTHER : hors d'Antananarivo, frais à convenir par téléphone. */
export type DeliveryZone = 'TANA' | 'OTHER';

/** Livraison demandée par le client au bot Messenger. */
export interface OrderDelivery {
  readonly phone: string;
  readonly address: string;
  readonly zone: DeliveryZone;
  /** Frais annoncés au client, ou null s'ils sont à convenir. */
  readonly fee: Money | null;
}

export interface Order extends BaseEntity {
  readonly reference: string;
  readonly clientId: EntityId | null;
  readonly status: OrderStatus;
  readonly source: OrderSource;
  /** Identifiant de la conversation / du message Messenger d'origine. */
  readonly externalRef: string | null;
  readonly totalAmount: Money;
  /** Vrai tant que les quantités de la commande sont réservées dans le stock. */
  readonly stockReserved: boolean;
  /** Vérification automatique du stock à l'import (commandes Messenger). */
  readonly stockCheck: StockCheck;
  /** Message d'origine du client (Messenger). */
  readonly customerMessage: string | null;
  /** Le vendeur doit vérifier la commande (message non compris, produit inconnu, stock insuffisant). */
  readonly needsReview: boolean;
  readonly notes: string | null;
  readonly orderedAt: IsoDateString;
  /** Coordonnées de livraison données au bot (null : commande saisie ou sans coordonnées). */
  readonly delivery: OrderDelivery | null;
}

export interface OrderItem extends BaseEntity {
  readonly orderId: EntityId;
  readonly productId: EntityId;
  readonly quantity: number;
  /** Prix unitaire figé au moment de la commande. */
  readonly unitPrice: Money;
  readonly lineTotal: Money;
}

export interface OrderStatusChange extends BaseEntity {
  readonly orderId: EntityId;
  readonly fromStatus: OrderStatus | null;
  readonly toStatus: OrderStatus;
  readonly note: string | null;
}

export type OrderInput = EntityInput<Order>;
export type OrderItemInput = EntityInput<OrderItem>;
export type OrderStatusChangeInput = EntityInput<OrderStatusChange>;

/** Ligne saisie par le vendeur, avant enregistrement. */
export interface OrderLineDraft {
  readonly productId: EntityId;
  readonly quantity: number;
  readonly unitPrice: Money;
}

/** Contenu d'une commande à créer ou modifier. */
export interface OrderDraft {
  readonly clientId: EntityId | null;
  readonly notes: string | null;
  readonly lines: readonly OrderLineDraft[];
}

/** Ligne de la liste des commandes. */
export interface OrderSummary {
  readonly order: Order;
  readonly clientName: string | null;
  readonly itemCount: number;
}

export interface OrderLineDetail {
  readonly item: OrderItem;
  readonly productName: string;
  readonly productImageUri: string | null;
}

/** Produit commandé en quantité supérieure au stock disponible. */
export interface StockShortage {
  readonly productId: EntityId;
  readonly productName: string;
  readonly requested: number;
  readonly available: number;
}

export interface OrderDetail {
  readonly order: Order;
  readonly client: Client | null;
  readonly lines: readonly OrderLineDetail[];
  readonly history: readonly OrderStatusChange[];
  /** Manques de stock actuels ; toujours vide une fois le stock réservé (commande validée ou terminée). */
  readonly shortages: readonly StockShortage[];
}
