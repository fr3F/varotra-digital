import {
  EntityId,
  STOCK_MOVEMENT_ORIGINS,
  STOCK_MOVEMENT_TYPES,
  StockMovement,
  StockMovementEntry,
  StockMovementInput,
  StockMovementType,
} from '@/models';
import { database } from '../database';
import { readEnum, readNullableNumber, readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow, SqlValue } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

export interface MovementQuery {
  /** null = tous les types. */
  readonly type: StockMovementType | null;
  readonly limit: number;
}

class StockMovementRepository extends BaseRepository<StockMovement, StockMovementInput> {
  protected readonly tableName = 'stock_movements';
  protected readonly entityLabel = 'Mouvement de stock';
  // rowid départage deux mouvements enregistrés dans la même milliseconde.
  protected readonly defaultOrderBy = 'created_at DESC, rowid DESC';

  async findByProduct(productId: EntityId, limit: number, executor: SqlExecutor = database): Promise<StockMovement[]> {
    const rows = await executor.select(
      `SELECT * FROM stock_movements
       WHERE product_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?`,
      [productId, limit],
    );
    return rows.map((row) => this.fromRow(row));
  }

  /** Derniers mouvements tous produits confondus, avec le nom du produit. */
  async findRecent(query: MovementQuery, executor: SqlExecutor = database): Promise<StockMovementEntry[]> {
    const params: SqlValue[] = [];
    let typeClause = '';
    if (query.type !== null) {
      typeClause = 'AND m.type = ?';
      params.push(query.type);
    }
    params.push(query.limit);

    const rows = await executor.select(
      `SELECT m.*, p.name AS product_name, p.deleted_at AS product_deleted_at
       FROM stock_movements AS m
       JOIN products AS p ON p.id = m.product_id
       WHERE m.deleted_at IS NULL ${typeClause}
       ORDER BY m.created_at DESC, m.rowid DESC
       LIMIT ?`,
      params,
    );
    return rows.map((row) => ({
      movement: this.fromRow(row),
      productName: readString(row, 'product_name'),
      productDeleted: readNullableString(row, 'product_deleted_at') !== null,
    }));
  }

  async findByReference(referenceId: EntityId, executor: SqlExecutor = database): Promise<StockMovement[]> {
    const rows = await executor.select(
      `SELECT * FROM stock_movements
       WHERE reference_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC, rowid ASC`,
      [referenceId],
    );
    return rows.map((row) => this.fromRow(row));
  }

  protected fromRow(row: SqlRow): StockMovement {
    return {
      ...this.readBaseFields(row),
      productId: readString(row, 'product_id'),
      type: readEnum(row, 'type', STOCK_MOVEMENT_TYPES),
      quantityDelta: readNumber(row, 'quantity_delta'),
      quantityAfter: readNullableNumber(row, 'quantity_after'),
      origin: readEnum(row, 'origin', STOCK_MOVEMENT_ORIGINS),
      reason: readNullableString(row, 'reason'),
      referenceId: readNullableString(row, 'reference_id'),
    };
  }

  protected toColumns(input: StockMovementInput): ColumnValues {
    return {
      product_id: input.productId,
      type: input.type,
      quantity_delta: input.quantityDelta,
      quantity_after: input.quantityAfter,
      origin: input.origin,
      reason: input.reason,
      reference_id: input.referenceId,
    };
  }
}

export const stockMovementRepository = new StockMovementRepository();
