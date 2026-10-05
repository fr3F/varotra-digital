import { EntityId, OrderItem, OrderItemInput, OrderLineDetail } from '@/models';
import { nowIso } from '@/utils/date.utils';
import { database } from '../database';
import { readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

class OrderItemRepository extends BaseRepository<OrderItem, OrderItemInput> {
  protected readonly tableName = 'order_items';
  protected readonly entityLabel = 'Ligne de commande';
  protected readonly defaultOrderBy = 'created_at ASC, rowid ASC';

  async findByOrder(orderId: EntityId, executor: SqlExecutor = database): Promise<OrderItem[]> {
    const rows = await executor.select(
      `SELECT * FROM order_items WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at ASC, rowid ASC`,
      [orderId],
    );
    return rows.map((row) => this.fromRow(row));
  }

  /** Lignes avec le nom et l'image du produit (produits supprimés compris, pour l'historique). */
  async findDetailsByOrder(orderId: EntityId, executor: SqlExecutor = database): Promise<OrderLineDetail[]> {
    const rows = await executor.select(
      `SELECT i.*, p.name AS product_name, p.image_uri AS product_image_uri
       FROM order_items AS i
       JOIN products AS p ON p.id = i.product_id
       WHERE i.order_id = ? AND i.deleted_at IS NULL
       ORDER BY i.created_at ASC, i.rowid ASC`,
      [orderId],
    );
    return rows.map((row) => ({
      item: this.fromRow(row),
      productName: readString(row, 'product_name'),
      productImageUri: readNullableString(row, 'product_image_uri'),
    }));
  }

  async softDeleteByOrder(orderId: EntityId, executor: SqlExecutor = database): Promise<void> {
    const now = nowIso();
    await executor.run(
      `UPDATE order_items SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING'
       WHERE order_id = ? AND deleted_at IS NULL`,
      [now, now, orderId],
    );
  }

  protected fromRow(row: SqlRow): OrderItem {
    return {
      ...this.readBaseFields(row),
      orderId: readString(row, 'order_id'),
      productId: readString(row, 'product_id'),
      quantity: readNumber(row, 'quantity'),
      unitPrice: readNumber(row, 'unit_price'),
      lineTotal: readNumber(row, 'line_total'),
    };
  }

  protected toColumns(input: OrderItemInput): ColumnValues {
    return {
      order_id: input.orderId,
      product_id: input.productId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      line_total: input.lineTotal,
    };
  }
}

export const orderItemRepository = new OrderItemRepository();
