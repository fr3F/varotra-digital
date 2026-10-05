import { BaseEntity, EntityInput, Money } from './base.model';

export interface Product extends BaseEntity {
  readonly name: string;
  readonly sku: string | null;
  readonly description: string | null;
  readonly category: string | null;
  /** URI de l'image stockée par l'application (voir services/image-storage). */
  readonly imageUri: string | null;
  readonly unitPrice: Money;
  readonly costPrice: Money;
  /** Quantité physique, maintenue uniquement par les mouvements de stock. */
  readonly stockQuantity: number;
  /** Unités réservées par des commandes confirmées, pas encore livrées. */
  readonly reservedQuantity: number;
  readonly alertThreshold: number;
}

/** Stock et réservations ne sont jamais saisis directement : ils passent par StockService. */
export type ProductInput = Omit<EntityInput<Product>, 'stockQuantity' | 'reservedQuantity'>;

/** Quantité encore vendable : stock physique moins les réservations. */
export function availableQuantity(product: Product): number {
  return Math.max(product.stockQuantity - product.reservedQuantity, 0);
}

export function isLowStock(product: Product): boolean {
  return availableQuantity(product) <= product.alertThreshold;
}
