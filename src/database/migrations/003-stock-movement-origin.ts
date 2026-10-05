import { Migration } from './migration.types';

/**
 * Historique de stock enrichi :
 * - origin : d'où vient le mouvement (saisie manuelle, stock initial, vente, commande) ;
 * - quantity_after : quantité du produit juste après le mouvement, recalculée pour l'existant.
 */
export const stockMovementOrigin: Migration = {
  version: 3,
  name: 'stock-movement-origin',
  sql: `
    ALTER TABLE stock_movements ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL'
      CHECK (origin IN ('MANUAL', 'INITIAL', 'SALE', 'ORDER'));
    ALTER TABLE stock_movements ADD COLUMN quantity_after INTEGER
      CHECK (quantity_after IS NULL OR quantity_after >= 0);

    UPDATE stock_movements SET origin = 'INITIAL' WHERE reason = 'Stock initial';

    UPDATE stock_movements SET quantity_after = (
      SELECT SUM(previous.quantity_delta)
      FROM stock_movements AS previous
      WHERE previous.product_id = stock_movements.product_id
        AND previous.deleted_at IS NULL
        AND (previous.created_at < stock_movements.created_at
          OR (previous.created_at = stock_movements.created_at AND previous.rowid <= stock_movements.rowid))
    );

    CREATE INDEX idx_stock_movements_created ON stock_movements (created_at);
    CREATE INDEX idx_stock_movements_reference ON stock_movements (reference_id) WHERE reference_id IS NOT NULL;
  `,
};
