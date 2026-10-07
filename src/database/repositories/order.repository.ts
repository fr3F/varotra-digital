import {
  EntityId,
  Order,
  OrderDelivery,
  ORDER_SOURCES,
  ORDER_STATUSES,
  OrderInput,
  OrderSummary,
  STOCK_CHECKS,
} from '@/models';
import { database } from '../database';
import { readEnum, readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

/** Livraison lue sur la commande ; null sans téléphone ou sans adresse. */
function readDelivery(row: SqlRow): OrderDelivery | null {
  const phone = readNullableString(row, 'delivery_phone');
  const address = readNullableString(row, 'delivery_address');
  if (phone === null || address === null) {
    return null;
  }
  const fee = row['delivery_fee'];
  return {
    phone,
    address,
    zone: row['delivery_zone'] === 'TANA' ? 'TANA' : 'OTHER',
    fee: typeof fee === 'number' ? fee : null,
  };
}

class OrderRepository extends BaseRepository<Order, OrderInput> {
  protected readonly tableName = 'orders';
  protected readonly entityLabel = 'Commande';
  protected readonly defaultOrderBy = 'ordered_at DESC, rowid DESC';

  /** Liste avec le nom du client et le nombre de lignes, plus récentes d'abord. */
  async findSummaries(executor: SqlExecutor = database): Promise<OrderSummary[]> {
    const rows = await executor.select(
      `SELECT o.*, c.name AS client_name,
         (SELECT COUNT(*) FROM order_items AS i WHERE i.order_id = o.id AND i.deleted_at IS NULL) AS item_count
       FROM orders AS o
       LEFT JOIN clients AS c ON c.id = o.client_id
       WHERE o.deleted_at IS NULL
       ORDER BY o.ordered_at DESC, o.rowid DESC`,
    );
    return rows.map((row) => ({
      order: this.fromRow(row),
      clientName: readNullableString(row, 'client_name'),
      itemCount: readNumber(row, 'item_count'),
    }));
  }

  /** Nombre de références déjà attribuées avec ce préfixe (commandes supprimées comprises). */
  async countReferences(prefix: string, executor: SqlExecutor = database): Promise<number> {
    const row = await executor.selectOne('SELECT COUNT(*) AS total FROM orders WHERE reference LIKE ?', [
      `${prefix}%`,
    ]);
    const total = row?.['total'];
    return typeof total === 'number' ? total : 0;
  }

  async countOpenByClient(clientId: EntityId, executor: SqlExecutor = database): Promise<number> {
    const row = await executor.selectOne(
      `SELECT COUNT(*) AS total FROM orders
       WHERE client_id = ? AND deleted_at IS NULL AND status IN ('NEW', 'PREPARING', 'CONFIRMED')`,
      [clientId],
    );
    const total = row?.['total'];
    return typeof total === 'number' ? total : 0;
  }

  protected fromRow(row: SqlRow): Order {
    return {
      ...this.readBaseFields(row),
      reference: readString(row, 'reference'),
      clientId: readNullableString(row, 'client_id'),
      status: readEnum(row, 'status', ORDER_STATUSES),
      source: readEnum(row, 'source', ORDER_SOURCES),
      externalRef: readNullableString(row, 'external_ref'),
      totalAmount: readNumber(row, 'total_amount'),
      stockReserved: readNumber(row, 'stock_reserved') === 1,
      stockCheck: readEnum(row, 'stock_check', STOCK_CHECKS),
      customerMessage: readNullableString(row, 'customer_message'),
      needsReview: readNumber(row, 'needs_review') === 1,
      notes: readNullableString(row, 'notes'),
      orderedAt: readString(row, 'ordered_at'),
      delivery: readDelivery(row),
    };
  }

  protected toColumns(input: OrderInput): ColumnValues {
    return {
      reference: input.reference,
      client_id: input.clientId,
      status: input.status,
      source: input.source,
      external_ref: input.externalRef,
      total_amount: input.totalAmount,
      stock_reserved: input.stockReserved ? 1 : 0,
      stock_check: input.stockCheck,
      customer_message: input.customerMessage,
      needs_review: input.needsReview ? 1 : 0,
      notes: input.notes,
      ordered_at: input.orderedAt,
      delivery_phone: input.delivery?.phone ?? null,
      delivery_address: input.delivery?.address ?? null,
      delivery_zone: input.delivery?.zone ?? null,
      delivery_fee: input.delivery?.fee ?? null,
    };
  }
}

export const orderRepository = new OrderRepository();
