import { Migration } from './migration.types';

const SYNC_COLUMNS = `
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))`;

const ORDER_STATUS_CHECK = `('NEW', 'PREPARING', 'CONFIRMED', 'DELIVERED', 'CANCELLED')`;

/**
 * Cycle de vie des commandes.
 * - Nouveaux statuts (Nouvelle, Préparation, Confirmée, Livrée, Annulée) : SQLite ne permet pas
 *   de modifier une contrainte CHECK, la table orders est donc reconstruite en conservant ses lignes
 *   (PENDING devient NEW). defer_foreign_keys reporte la vérification des clés de sales.order_id
 *   au commit, une fois la nouvelle table renommée.
 * - products.reserved_quantity : unités réservées par les commandes confirmées, pas encore livrées.
 * - order_status_history : journal des changements de statut.
 */
export const ordersWorkflow: Migration = {
  version: 4,
  name: 'orders-workflow',
  sql: `
    PRAGMA defer_foreign_keys = ON;

    ALTER TABLE products ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0
      CHECK (reserved_quantity >= 0);

    CREATE TABLE orders_v2 (
      id TEXT PRIMARY KEY NOT NULL,
      reference TEXT NOT NULL,
      client_id TEXT REFERENCES clients (id),
      status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ${ORDER_STATUS_CHECK}),
      source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'MESSENGER')),
      external_ref TEXT,
      total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
      stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved IN (0, 1)),
      notes TEXT,
      ordered_at TEXT NOT NULL,${SYNC_COLUMNS}
    );
    INSERT INTO orders_v2 (
      id, reference, client_id, status, source, external_ref, total_amount, stock_reserved,
      notes, ordered_at, created_at, updated_at, deleted_at, sync_status
    )
    SELECT
      id, reference, client_id, CASE status WHEN 'PENDING' THEN 'NEW' ELSE status END, source,
      external_ref, total_amount, 0, notes, ordered_at, created_at, updated_at, deleted_at, sync_status
    FROM orders;

    CREATE TABLE order_items_v2 (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES orders_v2 (id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products (id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      line_total INTEGER NOT NULL CHECK (line_total >= 0),${SYNC_COLUMNS}
    );
    INSERT INTO order_items_v2 SELECT
      id, order_id, product_id, quantity, unit_price, line_total, created_at, updated_at, deleted_at, sync_status
    FROM order_items;

    DROP TABLE order_items;
    DROP TABLE orders;
    -- Le renommage met à jour la clé étrangère de order_items_v2 (et rétablit celle de sales).
    ALTER TABLE orders_v2 RENAME TO orders;
    ALTER TABLE order_items_v2 RENAME TO order_items;

    CREATE UNIQUE INDEX idx_orders_reference ON orders (reference);
    CREATE INDEX idx_orders_status ON orders (status, ordered_at);
    CREATE INDEX idx_orders_client ON orders (client_id);
    CREATE INDEX idx_order_items_order ON order_items (order_id);
    CREATE INDEX idx_order_items_product ON order_items (product_id);

    CREATE TABLE order_status_history (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      from_status TEXT CHECK (from_status IS NULL OR from_status IN ${ORDER_STATUS_CHECK}),
      to_status TEXT NOT NULL CHECK (to_status IN ${ORDER_STATUS_CHECK}),
      note TEXT,${SYNC_COLUMNS}
    );
    CREATE INDEX idx_order_status_history_order ON order_status_history (order_id, created_at);
  `,
};
