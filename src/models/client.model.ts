import { BaseEntity, EntityId, EntityInput, IsoDateString, Money } from './base.model';
import type { OrderStatus } from './order.model';

export interface Client extends BaseEntity {
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  /** Identifiant Messenger (PSID), renseigné par la future synchronisation. */
  readonly messengerId: string | null;
}

export type ClientInput = EntityInput<Client>;

/** Ligne du carnet client : le client et ses chiffres clés. */
export interface ClientSummary {
  readonly client: Client;
  readonly orderCount: number;
  /** Total des achats conclus (commandes livrées + ventes directes). */
  readonly totalSpent: Money;
  readonly lastPurchaseAt: IsoDateString | null;
}

export type PurchaseKind = 'ORDER' | 'SALE';

/** Élément de l'historique d'achat : une commande (quel que soit son statut) ou une vente directe. */
export interface PurchaseHistoryEntry {
  readonly kind: PurchaseKind;
  readonly id: EntityId;
  readonly reference: string | null;
  /** Statut de la commande ; null pour une vente directe. */
  readonly status: OrderStatus | null;
  readonly amount: Money;
  readonly itemCount: number;
  readonly occurredAt: IsoDateString;
}

export interface CustomerStats {
  readonly orderCount: number;
  readonly openOrderCount: number;
  /** Commandes livrées + ventes directes. */
  readonly purchaseCount: number;
  readonly totalSpent: Money;
  readonly averageBasket: Money;
  readonly lastPurchaseAt: IsoDateString | null;
}

export interface PurchasedProduct {
  readonly productId: EntityId;
  readonly productName: string;
  readonly quantity: number;
  readonly amount: Money;
}

/** Fiche client complète. */
export interface CustomerProfile {
  readonly client: Client;
  readonly stats: CustomerStats;
  readonly history: readonly PurchaseHistoryEntry[];
  readonly topProducts: readonly PurchasedProduct[];
}
