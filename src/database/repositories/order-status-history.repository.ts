import { EntityId, ORDER_STATUSES, OrderStatusChange, OrderStatusChangeInput } from '@/models';
import { database } from '../database';
import { readEnum, readNullableString, readString } from '../sql-row';
import { SqlExecutor, SqlRow } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

class OrderStatusHistoryRepository extends BaseRepository<OrderStatusChange, OrderStatusChangeInput> {
  protected readonly tableName = 'order_status_history';
  protected readonly entityLabel = 'Changement de statut';
  protected readonly defaultOrderBy = 'created_at DESC, rowid DESC';

  async findByOrder(orderId: EntityId, executor: SqlExecutor = database): Promise<OrderStatusChange[]> {
    const rows = await executor.select(
      `SELECT * FROM order_status_history
       WHERE order_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC, rowid DESC`,
      [orderId],
    );
    return rows.map((row) => this.fromRow(row));
  }

  protected fromRow(row: SqlRow): OrderStatusChange {
    const fromStatus = readNullableString(row, 'from_status');
    return {
      ...this.readBaseFields(row),
      orderId: readString(row, 'order_id'),
      fromStatus: fromStatus === null ? null : readEnum(row, 'from_status', ORDER_STATUSES),
      toStatus: readEnum(row, 'to_status', ORDER_STATUSES),
      note: readNullableString(row, 'note'),
    };
  }

  protected toColumns(input: OrderStatusChangeInput): ColumnValues {
    return {
      order_id: input.orderId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      note: input.note,
    };
  }
}

export const orderStatusHistoryRepository = new OrderStatusHistoryRepository();
