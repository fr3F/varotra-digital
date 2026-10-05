import {
  ClientSummary,
  EntityId,
  IsoDateString,
  ORDER_STATUSES,
  PurchasedProduct,
  PurchaseHistoryEntry,
} from '@/models';
import { database } from '../database';
import { readEnum, readNullableString, readNumber, readString } from '../sql-row';
import { SqlRow } from '../sql.types';
import { clientRepository } from './client.repository';

/**
 * Un achat conclu = une commande livrée, ou une vente directe (sans commande d'origine,
 * pour ne pas compter deux fois une commande transformée en vente).
 */
const DELIVERED_ORDERS = `o.deleted_at IS NULL AND o.status = 'DELIVERED'`;
const DIRECT_SALES = `s.deleted_at IS NULL AND s.order_id IS NULL`;

function latest(a: IsoDateString | null, b: IsoDateString | null): IsoDateString | null {
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  return a > b ? a : b;
}

function toHistoryEntry(row: SqlRow): PurchaseHistoryEntry {
  const kind = readEnum(row, 'kind', ['ORDER', 'SALE'] as const);
  return {
    kind,
    id: readString(row, 'id'),
    reference: readNullableString(row, 'reference'),
    status: kind === 'ORDER' ? readEnum(row, 'status', ORDER_STATUSES) : null,
    amount: readNumber(row, 'amount'),
    itemCount: readNumber(row, 'item_count'),
    occurredAt: readString(row, 'occurred_at'),
  };
}

/** Requêtes de lecture pour le carnet client et l'historique d'achat. */
export const customerHistoryRepository = {
  /** Clients actifs avec nombre de commandes, total acheté et date du dernier achat. */
  async findSummaries(): Promise<ClientSummary[]> {
    const rows = await database.select(
      `SELECT c.*,
         (SELECT COUNT(*) FROM orders AS o WHERE o.client_id = c.id AND o.deleted_at IS NULL) AS order_count,
         (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders AS o WHERE o.client_id = c.id AND ${DELIVERED_ORDERS})
           + (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales AS s WHERE s.client_id = c.id AND ${DIRECT_SALES})
           AS total_spent,
         (SELECT MAX(o.ordered_at) FROM orders AS o WHERE o.client_id = c.id AND ${DELIVERED_ORDERS}) AS last_order_at,
         (SELECT MAX(s.sold_at) FROM sales AS s WHERE s.client_id = c.id AND ${DIRECT_SALES}) AS last_sale_at
       FROM clients AS c
       WHERE c.deleted_at IS NULL
       ORDER BY c.name COLLATE NOCASE ASC`,
    );
    return rows.map((row) => ({
      client: clientRepository.mapRow(row),
      orderCount: readNumber(row, 'order_count'),
      totalSpent: readNumber(row, 'total_spent'),
      lastPurchaseAt: latest(readNullableString(row, 'last_order_at'), readNullableString(row, 'last_sale_at')),
    }));
  },

  /** Commandes (tous statuts) et ventes directes du client, plus récentes d'abord. */
  async findHistory(clientId: EntityId, limit = 200): Promise<PurchaseHistoryEntry[]> {
    const rows = await database.select(
      `SELECT 'ORDER' AS kind, o.id, o.reference, o.status, o.total_amount AS amount, o.ordered_at AS occurred_at,
         (SELECT COUNT(*) FROM order_items AS i WHERE i.order_id = o.id AND i.deleted_at IS NULL) AS item_count
       FROM orders AS o
       WHERE o.client_id = ? AND o.deleted_at IS NULL
       UNION ALL
       SELECT 'SALE' AS kind, s.id, NULL AS reference, NULL AS status, s.total_amount AS amount, s.sold_at AS occurred_at,
         (SELECT COUNT(*) FROM sale_items AS si WHERE si.sale_id = s.id AND si.deleted_at IS NULL) AS item_count
       FROM sales AS s
       WHERE s.client_id = ? AND ${DIRECT_SALES}
       ORDER BY occurred_at DESC
       LIMIT ?`,
      [clientId, clientId, limit],
    );
    return rows.map(toHistoryEntry);
  },

  /** Produits les plus achetés par le client (achats conclus uniquement). */
  async findTopProducts(clientId: EntityId, limit = 5): Promise<PurchasedProduct[]> {
    const rows = await database.select(
      `SELECT lines.product_id, p.name AS product_name,
         SUM(lines.quantity) AS quantity, SUM(lines.line_total) AS amount
       FROM (
         SELECT i.product_id, i.quantity, i.line_total
         FROM order_items AS i JOIN orders AS o ON o.id = i.order_id
         WHERE o.client_id = ? AND ${DELIVERED_ORDERS} AND i.deleted_at IS NULL
         UNION ALL
         SELECT si.product_id, si.quantity, si.line_total
         FROM sale_items AS si JOIN sales AS s ON s.id = si.sale_id
         WHERE s.client_id = ? AND ${DIRECT_SALES} AND si.deleted_at IS NULL
       ) AS lines
       JOIN products AS p ON p.id = lines.product_id
       GROUP BY lines.product_id, p.name
       ORDER BY quantity DESC, amount DESC
       LIMIT ?`,
      [clientId, clientId, limit],
    );
    return rows.map((row) => ({
      productId: readString(row, 'product_id'),
      productName: readString(row, 'product_name'),
      quantity: readNumber(row, 'quantity'),
      amount: readNumber(row, 'amount'),
    }));
  },
};
