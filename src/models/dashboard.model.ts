import { IsoDateString, Money } from './base.model';
import { CategoryTotal } from './expense.model';
import { Period } from './period.model';
import { Product } from './product.model';

/** Découpage du graphique du chiffre d'affaires : jours, semaines, mois ou années. */
export const REVENUE_GRANULARITIES = ['DAY', 'WEEK', 'MONTH', 'YEAR'] as const;
export type RevenueGranularity = (typeof REVENUE_GRANULARITIES)[number];

/** Nombre de barres proposé pour chaque découpage (le vendeur choisit). */
export const REVENUE_COUNT_OPTIONS: Readonly<Record<RevenueGranularity, readonly number[]>> = {
  DAY: [7, 14, 30],
  WEEK: [4, 8, 12],
  MONTH: [3, 6, 12],
  YEAR: [3, 5, 10],
};

/** Nombre de barres par défaut pour chaque découpage. */
export const REVENUE_BUCKET_COUNTS: Readonly<Record<RevenueGranularity, number>> = {
  DAY: 7,
  WEEK: 8,
  MONTH: 12,
  YEAR: 5,
};

export interface DailyRevenue {
  /** Début de l'intervalle local (jour, semaine, mois ou année), en ISO. */
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
  /** Nombre de produits du catalogue (0 : rien à surveiller, le message « tout va bien » serait faux). */
  readonly productCount: number;
  /** Produits en rupture (disponible = 0), comptés parmi lowStockCount. */
  readonly outOfStockCount: number;
  readonly expensesByCategory: readonly CategoryTotal[];
}
