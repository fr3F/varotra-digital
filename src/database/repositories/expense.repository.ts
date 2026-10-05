import {
  CategoryTotal,
  Expense,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  ExpenseInput,
  IsoDateString,
} from '@/models';
import { database } from '../database';
import { readEnum, readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow, SqlValue } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

export interface ExpenseQuery {
  readonly since: IsoDateString | null;
  readonly category: ExpenseCategory | null;
}

function buildFilter(query: ExpenseQuery): { where: string; params: SqlValue[] } {
  const clauses = ['deleted_at IS NULL'];
  const params: SqlValue[] = [];
  if (query.since !== null) {
    clauses.push('spent_at >= ?');
    params.push(query.since);
  }
  if (query.category !== null) {
    clauses.push('category = ?');
    params.push(query.category);
  }
  return { where: clauses.join(' AND '), params };
}

class ExpenseRepository extends BaseRepository<Expense, ExpenseInput> {
  protected readonly tableName = 'expenses';
  protected readonly entityLabel = 'Dépense';
  protected readonly defaultOrderBy = 'spent_at DESC, rowid DESC';

  async findFiltered(query: ExpenseQuery, executor: SqlExecutor = database): Promise<Expense[]> {
    const { where, params } = buildFilter(query);
    const rows = await executor.select(
      `SELECT * FROM expenses WHERE ${where} ORDER BY spent_at DESC, rowid DESC`,
      params,
    );
    return rows.map((row) => this.fromRow(row));
  }

  /** Total par catégorie (catégories sans dépense exclues), du plus gros au plus petit. */
  async totalsByCategory(since: IsoDateString | null, executor: SqlExecutor = database): Promise<CategoryTotal[]> {
    const { where, params } = buildFilter({ since, category: null });
    const rows = await executor.select(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses WHERE ${where}
       GROUP BY category ORDER BY total DESC`,
      params,
    );
    return rows.map((row) => ({
      category: readEnum(row, 'category', EXPENSE_CATEGORIES),
      total: readNumber(row, 'total'),
      count: readNumber(row, 'count'),
    }));
  }

  async total(since: IsoDateString | null, executor: SqlExecutor = database): Promise<number> {
    const { where, params } = buildFilter({ since, category: null });
    const row = await executor.selectOne(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE ${where}`, params);
    return row === null ? 0 : readNumber(row, 'total');
  }

  protected fromRow(row: SqlRow): Expense {
    return {
      ...this.readBaseFields(row),
      label: readString(row, 'label'),
      category: readEnum(row, 'category', EXPENSE_CATEGORIES),
      amount: readNumber(row, 'amount'),
      notes: readNullableString(row, 'notes'),
      spentAt: readString(row, 'spent_at'),
    };
  }

  protected toColumns(input: ExpenseInput): ColumnValues {
    return {
      label: input.label,
      category: input.category,
      amount: input.amount,
      notes: input.notes,
      spent_at: input.spentAt,
    };
  }
}

export const expenseRepository = new ExpenseRepository();
