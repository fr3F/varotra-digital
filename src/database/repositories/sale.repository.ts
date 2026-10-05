import { IsoDateString, PAYMENT_METHODS, Sale, SaleInput, SaleSummary, SalesTotals } from '@/models';
import { database } from '../database';
import { readEnum, readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow, SqlValue } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

class SaleRepository extends BaseRepository<Sale, SaleInput> {
  protected readonly tableName = 'sales';
  protected readonly entityLabel = 'Vente';
  protected readonly defaultOrderBy = 'sold_at DESC, rowid DESC';

  /** Ventes depuis `since` (toutes si null), avec client, commande d'origine et nombre de lignes. */
  async findSummaries(since: IsoDateString | null, executor: SqlExecutor = database): Promise<SaleSummary[]> {
    const params: SqlValue[] = [];
    let periodClause = '';
    if (since !== null) {
      periodClause = 'AND s.sold_at >= ?';
      params.push(since);
    }
    const rows = await executor.select(
      `SELECT s.*, c.name AS client_name, o.reference AS order_reference,
         (SELECT COUNT(*) FROM sale_items AS i WHERE i.sale_id = s.id AND i.deleted_at IS NULL) AS item_count
       FROM sales AS s
       LEFT JOIN clients AS c ON c.id = s.client_id
       LEFT JOIN orders AS o ON o.id = s.order_id
       WHERE s.deleted_at IS NULL ${periodClause}
       ORDER BY s.sold_at DESC, s.rowid DESC`,
      params,
    );
    return rows.map((row) => ({
      sale: this.fromRow(row),
      clientName: readNullableString(row, 'client_name'),
      orderReference: readNullableString(row, 'order_reference'),
      itemCount: readNumber(row, 'item_count'),
    }));
  }

  /** Chiffre d'affaires, coût et bénéfice sur [since, until[ (bornes facultatives). */
  async totals(
    since: IsoDateString | null,
    until: IsoDateString | null = null,
    executor: SqlExecutor = database,
  ): Promise<SalesTotals> {
    const clauses = ['deleted_at IS NULL'];
    const params: SqlValue[] = [];
    if (since !== null) {
      clauses.push('sold_at >= ?');
      params.push(since);
    }
    if (until !== null) {
      clauses.push('sold_at < ?');
      params.push(until);
    }
    const row = await executor.selectOne(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(total_cost), 0) AS cost
       FROM sales WHERE ${clauses.join(' AND ')}`,
      params,
    );
    const revenue = row === null ? 0 : readNumber(row, 'revenue');
    const cost = row === null ? 0 : readNumber(row, 'cost');
    return { count: row === null ? 0 : readNumber(row, 'count'), revenue, cost, profit: revenue - cost };
  }

  async findByOrder(orderId: string, executor: SqlExecutor = database): Promise<Sale | null> {
    const row = await executor.selectOne('SELECT * FROM sales WHERE order_id = ? AND deleted_at IS NULL', [orderId]);
    return row === null ? null : this.fromRow(row);
  }

  async countReferences(prefix: string, executor: SqlExecutor = database): Promise<number> {
    const row = await executor.selectOne('SELECT COUNT(*) AS total FROM sales WHERE reference LIKE ?', [`${prefix}%`]);
    return row === null ? 0 : readNumber(row, 'total');
  }

  protected fromRow(row: SqlRow): Sale {
    const base = this.readBaseFields(row);
    return {
      ...base,
      // Ventes antérieures à la référence (migration 005) : identifiant court.
      reference: readNullableString(row, 'reference') ?? `VTE-${base.id.slice(0, 8).toUpperCase()}`,
      orderId: readNullableString(row, 'order_id'),
      clientId: readNullableString(row, 'client_id'),
      paymentMethod: readEnum(row, 'payment_method', PAYMENT_METHODS),
      totalAmount: readNumber(row, 'total_amount'),
      totalCost: readNumber(row, 'total_cost'),
      notes: readNullableString(row, 'notes'),
      soldAt: readString(row, 'sold_at'),
    };
  }

  protected toColumns(input: SaleInput): ColumnValues {
    return {
      reference: input.reference,
      order_id: input.orderId,
      client_id: input.clientId,
      payment_method: input.paymentMethod,
      total_amount: input.totalAmount,
      total_cost: input.totalCost,
      notes: input.notes,
      sold_at: input.soldAt,
    };
  }
}

export const saleRepository = new SaleRepository();
