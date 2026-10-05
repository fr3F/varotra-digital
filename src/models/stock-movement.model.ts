import { BaseEntity, EntityId, EntityInput } from './base.model';

export const STOCK_MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/** Origine du mouvement : saisie du vendeur ou conséquence automatique d'une autre opération. */
export const STOCK_MOVEMENT_ORIGINS = ['MANUAL', 'INITIAL', 'SALE', 'ORDER'] as const;
export type StockMovementOrigin = (typeof STOCK_MOVEMENT_ORIGINS)[number];

export interface StockMovement extends BaseEntity {
  readonly productId: EntityId;
  readonly type: StockMovementType;
  /** Variation signée : positive pour une entrée, négative pour une sortie. */
  readonly quantityDelta: number;
  /** Quantité du produit juste après ce mouvement. */
  readonly quantityAfter: number | null;
  readonly origin: StockMovementOrigin;
  readonly reason: string | null;
  /** Vente ou commande à l'origine du mouvement, le cas échéant. */
  readonly referenceId: EntityId | null;
}

export type StockMovementInput = EntityInput<StockMovement>;

/** Mouvement accompagné du nom du produit, pour l'historique global. */
export interface StockMovementEntry {
  readonly movement: StockMovement;
  readonly productName: string;
  /** Le produit a été supprimé depuis : son historique reste consultable. */
  readonly productDeleted: boolean;
}
