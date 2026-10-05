import { IsoDateString, Money } from './base.model';
import { CategoryTotal } from './expense.model';
import { Period } from './period.model';
import { Product } from './product.model';

export interface DailyRevenue {
  /** Début du jour local, en ISO. */
  readonly day: IsoDateString;
  readonly revenue: Money;
  readonly profit: Money;
  readonly salesCount: number;
}

export interface DashboardData {
  readonly period: Period;
  /** Chiffre d'affaires du jour (toujours affiché, quelle que soit la période). */
  readonly revenueToday: Money;
  readonly salesTodayCount: number;
  /** Indicateurs de la période choisie. */
  readonly revenue: Money;
  readonly salesCount: number;
  /** Bénéfice brut : ventes - prix d'achat des produits vendus. */
  readonly grossProfit: Money;
  readonly expenses: Money;
  /** Bénéfice net : bénéfice brut - dépenses. */
  readonly netProfit: Money;
  readonly ordersCreated: number;
  readonly openOrders: number;
  readonly lowStockProducts: readonly Product[];
  readonly lowStockCount: number;
  /** Les 7 derniers jours, du plus ancien au plus récent. */
  readonly last7Days: readonly DailyRevenue[];
  readonly expensesByCategory: readonly CategoryTotal[];
}
