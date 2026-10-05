import { Migration } from './migration.types';

/**
 * Ventes, dépenses et réglages.
 * - sales.reference / sales.total_cost et sale_items.unit_cost : le prix d'achat est figé
 *   au moment de la vente, pour que le bénéfice ne change pas si le prix d'achat évolue ensuite.
 * - expenses : nouvelles catégories (dont Publicité). La contrainte CHECK ne pouvant pas être
 *   modifiée, la table est reconstruite ; RENT et UTILITIES deviennent OTHER.
 * - app_settings : réglages clé/valeur (préférences de notification…).
 */
export const salesExpensesSettings: Migration = {
  version: 5,
  name: 'sales-expenses-settings',
  sql: `
    ALTER TABLE sales ADD COLUMN reference TEXT;
    ALTER TABLE sales ADD COLUMN total_cost INTEGER NOT NULL DEFAULT 0 CHECK (total_cost >= 0);
    CREATE UNIQUE INDEX idx_sales_reference ON sales (reference) WHERE reference IS NOT NULL;
    CREATE INDEX idx_sales_client ON sales (client_id);
    CREATE INDEX idx_sales_order ON sales (order_id) WHERE order_id IS NOT NULL;

    ALTER TABLE sale_items ADD COLUMN unit_cost INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost >= 0);
    CREATE INDEX idx_sale_items_product ON sale_items (product_id);

    CREATE TABLE expenses_v2 (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'OTHER'
        CHECK (category IN ('PURCHASE', 'TRANSPORT', 'ADVERTISING', 'SALARY', 'OTHER')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      notes TEXT,
      spent_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED'))
    );
    INSERT INTO expenses_v2 (id, label, category, amount, notes, spent_at, created_at, updated_at, deleted_at, sync_status)
    SELECT id, label,
      CASE WHEN category IN ('PURCHASE', 'TRANSPORT', 'SALARY') THEN category ELSE 'OTHER' END,
      MAX(amount, 1), notes, spent_at, created_at, updated_at, deleted_at, sync_status
    FROM expenses;
    DROP TABLE expenses;
    ALTER TABLE expenses_v2 RENAME TO expenses;
    CREATE INDEX idx_expenses_spent_at ON expenses (spent_at);
    CREATE INDEX idx_expenses_category ON expenses (category, spent_at);

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
};
