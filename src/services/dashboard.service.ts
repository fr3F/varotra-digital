import { dashboardRepository } from '@/database/repositories/dashboard.repository';
import { expenseRepository } from '@/database/repositories/expense.repository';
import { productRepository } from '@/database/repositories/product.repository';
import { saleRepository } from '@/database/repositories/sale.repository';
import {
  availableQuantity,
  DailyRevenue,
  DashboardData,
  isLowStock,
  Period,
  periodStart,
  REVENUE_BUCKET_COUNTS,
  RevenueGranularity,
} from '@/models';

const LOW_STOCK_PREVIEW = 5;

/** Début (local) de l'intervalle contenant `reference`, décalé de `offset` intervalles. */
function bucketStart(granularity: RevenueGranularity, reference: Date, offset: number): Date {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const day = reference.getDate();
  switch (granularity) {
    case 'DAY':
      return new Date(year, month, day + offset);
    case 'WEEK': {
      // Semaines du lundi au dimanche.
      const monday = day - ((reference.getDay() + 6) % 7);
      return new Date(year, month, monday + offset * 7);
    }
    case 'MONTH':
      return new Date(year, month + offset, 1);
    case 'YEAR':
      return new Date(year + offset, 0, 1);
  }
}

/** Indicateurs du tableau de bord, calculés à partir de SQLite. */
export const dashboardService = {
  async load(period: Period, reference: Date = new Date()): Promise<DashboardData> {
    const since = periodStart(period, reference);

    const [today, periodSales, expenses, ordersCreated, openOrders, products, expensesByCategory] =
      await Promise.all([
        saleRepository.totals(periodStart('TODAY', reference)),
        saleRepository.totals(since),
        expenseRepository.total(since),
        dashboardRepository.countOrdersSince(since),
        dashboardRepository.countOpenOrders(),
        productRepository.findAll(),
        expenseRepository.totalsByCategory(since),
      ]);

    // Les plus urgents d'abord : quantité disponible la plus faible.
    const lowStock = products
      .filter(isLowStock)
      .sort((a, b) => availableQuantity(a) - availableQuantity(b) || a.name.localeCompare(b.name, 'fr'));

    return {
      period,
      revenueToday: today.revenue,
      salesTodayCount: today.count,
      revenue: periodSales.revenue,
      salesCount: periodSales.count,
      grossProfit: periodSales.profit,
      expenses,
      netProfit: periodSales.profit - expenses,
      ordersCreated,
      openOrders,
      lowStockProducts: lowStock.slice(0, LOW_STOCK_PREVIEW),
      lowStockCount: lowStock.length,
      productCount: products.length,
      outOfStockCount: lowStock.filter((product) => availableQuantity(product) === 0).length,
      expensesByCategory,
    };
  },

  /**
   * Chiffre d'affaires et bénéfice par intervalle (le plus ancien d'abord), jusqu'à l'intervalle
   * en cours inclus : 7 jours, 8 semaines, 12 mois ou 5 ans.
   */
  revenueSeries(granularity: RevenueGranularity, reference: Date = new Date()): Promise<DailyRevenue[]> {
    const count = REVENUE_BUCKET_COUNTS[granularity];
    const starts = Array.from({ length: count }, (_, index) =>
      bucketStart(granularity, reference, index - (count - 1)).toISOString(),
    );
    const end = bucketStart(granularity, reference, 1).toISOString();
    return dashboardRepository.revenueByDay(starts, end);
  },
};
