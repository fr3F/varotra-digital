import { DailyRevenue, IsoDateString, OPEN_ORDER_STATUSES } from '@/models';
import { database } from '../database';
import { readNumber } from '../sql-row';

/** Requêtes d'agrégation en lecture seule pour le tableau de bord. */
export const dashboardRepository = {
  async countOrdersSince(since: IsoDateString | null): Promise<number> {
    const row = await database.selectOne(
      `SELECT COUNT(*) AS total FROM orders WHERE deleted_at IS NULL ${since === null ? '' : 'AND ordered_at >= ?'}`,
      since === null ? [] : [since],
    );
    return row === null ? 0 : readNumber(row, 'total');
  },

  async countOpenOrders(): Promise<number> {
    const placeholders = OPEN_ORDER_STATUSES.map(() => '?').join(', ');
    const row = await database.selectOne(
      `SELECT COUNT(*) AS total FROM orders WHERE deleted_at IS NULL AND status IN (${placeholders})`,
      [...OPEN_ORDER_STATUSES],
    );
    return row === null ? 0 : readNumber(row, 'total');
  },

  /**
   * Chiffre d'affaires et bénéfice par jour local. `dayStarts` : débuts de jour en ISO,
   * croissants ; le dernier jour se termine à `end`.
   */
  async revenueByDay(dayStarts: readonly IsoDateString[], end: IsoDateString): Promise<DailyRevenue[]> {
    return Promise.all(
      dayStarts.map(async (day, index) => {
        const until = dayStarts[index + 1] ?? end;
        const row = await database.selectOne(
          `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(total_cost), 0) AS cost
           FROM sales WHERE deleted_at IS NULL AND sold_at >= ? AND sold_at < ?`,
          [day, until],
        );
        const revenue = row === null ? 0 : readNumber(row, 'revenue');
        const cost = row === null ? 0 : readNumber(row, 'cost');
        return { day, revenue, profit: revenue - cost, salesCount: row === null ? 0 : readNumber(row, 'count') };
      }),
    );
  },
};
