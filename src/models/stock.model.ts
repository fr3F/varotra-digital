import { Money } from './base.model';
import { availableQuantity, isLowStock, Product } from './product.model';

export interface StockSummary {
  readonly productsCount: number;
  readonly totalUnits: number;
  /** Unités réservées par les commandes confirmées. */
  readonly reservedUnits: number;
  /** Valeur du stock au prix d'achat. */
  readonly valueAtCost: Money;
  /** Valeur du stock au prix de vente (chiffre d'affaires potentiel). */
  readonly valueAtPrice: Money;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
}

export type StockLevel = 'OUT' | 'LOW' | 'OK';

/** Niveau calculé sur la quantité disponible (les unités réservées ne sont plus vendables). */
export function stockLevelOf(product: Product): StockLevel {
  if (availableQuantity(product) === 0) {
    return 'OUT';
  }
  return isLowStock(product) ? 'LOW' : 'OK';
}

export function summarizeStock(products: readonly Product[]): StockSummary {
  return products.reduce<StockSummary>(
    (summary, product) => {
      const level = stockLevelOf(product);
      return {
        productsCount: summary.productsCount + 1,
        totalUnits: summary.totalUnits + product.stockQuantity,
        reservedUnits: summary.reservedUnits + product.reservedQuantity,
        valueAtCost: summary.valueAtCost + product.stockQuantity * product.costPrice,
        valueAtPrice: summary.valueAtPrice + product.stockQuantity * product.unitPrice,
        lowStockCount: summary.lowStockCount + (level === 'LOW' ? 1 : 0),
        outOfStockCount: summary.outOfStockCount + (level === 'OUT' ? 1 : 0),
      };
    },
    {
      productsCount: 0,
      totalUnits: 0,
      reservedUnits: 0,
      valueAtCost: 0,
      valueAtPrice: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    },
  );
}
