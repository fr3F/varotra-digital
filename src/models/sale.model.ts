import { BaseEntity, EntityId, EntityInput, IsoDateString, Money } from './base.model';
import type { Client } from './client.model';

export const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'CARD', 'CREDIT'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  CREDIT: 'À crédit',
};

export interface Sale extends BaseEntity {
  /** VTE-AAAAMMJJ-NNN. */
  readonly reference: string;
  /** Commande livrée à l'origine de la vente, le cas échéant. */
  readonly orderId: EntityId | null;
  readonly clientId: EntityId | null;
  readonly paymentMethod: PaymentMethod;
  /** Chiffre d'affaires de la vente. */
  readonly totalAmount: Money;
  /** Coût d'achat des produits vendus, figé au moment de la vente. */
  readonly totalCost: Money;
  readonly notes: string | null;
  readonly soldAt: IsoDateString;
}

export interface SaleItem extends BaseEntity {
  readonly saleId: EntityId;
  readonly productId: EntityId;
  readonly quantity: number;
  readonly unitPrice: Money;
  /** Prix d'achat unitaire figé au moment de la vente. */
  readonly unitCost: Money;
  readonly lineTotal: Money;
}

export type SaleInput = EntityInput<Sale>;
export type SaleItemInput = EntityInput<SaleItem>;

/** Bénéfice = prix de vente - prix d'achat. */
export function saleProfit(sale: Pick<Sale, 'totalAmount' | 'totalCost'>): Money {
  return sale.totalAmount - sale.totalCost;
}

export function lineProfit(item: Pick<SaleItem, 'quantity' | 'unitPrice' | 'unitCost'>): Money {
  return (item.unitPrice - item.unitCost) * item.quantity;
}

/** Marge en pourcentage du chiffre d'affaires (null si CA nul). */
export function marginRate(amount: Money, profit: Money): number | null {
  return amount === 0 ? null : (profit / amount) * 100;
}

export interface SaleLineDraft {
  readonly productId: EntityId;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface SaleDraft {
  readonly clientId: EntityId | null;
  readonly paymentMethod: PaymentMethod;
  readonly notes: string | null;
  readonly lines: readonly SaleLineDraft[];
}

export interface SaleSummary {
  readonly sale: Sale;
  readonly clientName: string | null;
  readonly orderReference: string | null;
  readonly itemCount: number;
}

export interface SaleLineDetail {
  readonly item: SaleItem;
  readonly productName: string;
  readonly productImageUri: string | null;
}

export interface SaleDetail {
  readonly sale: Sale;
  readonly client: Client | null;
  readonly orderReference: string | null;
  readonly lines: readonly SaleLineDetail[];
}

export interface SalesTotals {
  readonly count: number;
  readonly revenue: Money;
  readonly cost: Money;
  readonly profit: Money;
}
