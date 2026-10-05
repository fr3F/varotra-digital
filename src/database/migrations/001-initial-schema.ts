import { Migration } from './migration.types';

/**
 * Schéma initial. Conventions :
 * - id TEXT (UUID) pour fusionner sans conflit lors de la synchronisation future ;
 * - montants en INTEGER (unité minimale de la devise) ;
 * - dates en TEXT ISO 8601 UTC ;
 * - suppression logique via deleted_at, sync_status pour savoir ce qui reste à synchroniser.
 */
export const initialSchema: Migration = {
  version: 1,
  name: 'initial-schema',
  sql: `
    CREATE TABLE clients (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      messenger_id TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );

    CREATE TABLE products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      description TEXT,
      category TEXT,
      unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
      cost_price INTEGER NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      alert_threshold INTEGER NOT NULL DEFAULT 0 CHECK (alert_threshold >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    CREATE UNIQUE INDEX idx_products_sku ON products (sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE stock_movements (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL REFERENCES products (id),
      type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
      quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
      reason TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    CREATE INDEX idx_stock_movements_product ON stock_movements (product_id, created_at);

    CREATE TABLE orders (
      id TEXT PRIMARY KEY NOT NULL,
      reference TEXT NOT NULL,
      client_id TEXT REFERENCES clients (id),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED')),
      source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'MESSENGER')),
      external_ref TEXT,
      total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
      notes TEXT,
      ordered_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    CREATE INDEX idx_orders_status ON orders (status, ordered_at);

    CREATE TABLE order_items (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products (id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      line_total INTEGER NOT NULL CHECK (line_total >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    CREATE INDEX idx_order_items_order ON order_items (order_id);

    CREATE TABLE sales (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT REFERENCES orders (id),
      client_id TEXT REFERENCES clients (id),
      payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'MOBILE_MONEY', 'CARD', 'CREDIT')),
      total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
      notes TEXT,
      sold_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    CREATE INDEX idx_sales_sold_at ON sales (sold_at);

    CREATE TABLE sale_items (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products (id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      line_total INTEGER NOT NULL CHECK (line_total >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    CREATE INDEX idx_sale_items_sale ON sale_items (sale_id);

    CREATE TABLE expenses (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN ('PURCHASE', 'TRANSPORT', 'RENT', 'SALARY', 'UTILITIES', 'OTHER')),
      amount INTEGER NOT NULL CHECK (amount >= 0),
      notes TEXT,
      spent_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    CREATE INDEX idx_expenses_spent_at ON expenses (spent_at);
  `,
};
