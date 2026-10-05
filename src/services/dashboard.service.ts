import { dashboardRepository } from '@/database/repositories/dashboard.repository';
import { expenseRepository } from '@/database/repositories/expense.repository';
import { productRepository } from '@/database/repositories/product.repository';
import { saleRepository } from '@/database/repositories/sale.repository';
import { availableQuantity, DashboardData, isLowStock, Period, periodStart } from '@/models';

const LOW_STOCK_PREVIEW = 5;

/** Débuts des 7 derniers jours locaux (le plus ancien d'abord), en ISO. */
function last7DayStarts(reference: Date): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - (6 - index)).toISOString(),
  );
}

/** Indicateurs du tableau de bord, calculés à partir de SQLite. */
export const dashboardService = {
  async load(period: Period, reference: Date = new Date()): Promise<DashboardData> {
    const since = periodStart(period, reference);
    const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + 1).toISOString();

    const [today, periodSales, expenses, ordersCreated, openOrders, products, last7Days, expensesByCategory] =
      await Promise.all([
        saleRepository.totals(periodStart('TODAY', reference)),
        saleRepository.totals(since),
        expenseRepository.total(since),
        dashboardRepository.countOrdersSince(since),
        dashboardRepository.countOpenOrders(),
        productRepository.findAll(),
        dashboardRepository.revenueByDay(last7DayStarts(reference), end),
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
      last7Days,
      expensesByCategory,
    };
  },
};
