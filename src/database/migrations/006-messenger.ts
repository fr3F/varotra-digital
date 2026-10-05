import { Migration } from './migration.types';

/**
 * Intégration Messenger.
 * - orders.stock_check : résultat de la vérification automatique du stock à l'import ;
 * - orders.customer_message : message d'origine du client (texte libre) ;
 * - orders.needs_review : commande à vérifier par le vendeur (message non compris, produit inconnu…) ;
 * - index unique sur la référence Messenger : une commande reçue deux fois n'est importée qu'une fois ;
 * - messenger_outbox : changements de statut à signaler au client, envoyés dès que le réseau le permet.
 */
export const messenger: Migration = {
  version: 6,
  name: 'messenger',
  sql: `
    ALTER TABLE orders ADD COLUMN stock_check TEXT NOT NULL DEFAULT 'UNCHECKED'
      CHECK (stock_check IN ('UNCHECKED', 'OK', 'SHORTAGE'));
    ALTER TABLE orders ADD COLUMN customer_message TEXT;
    ALTER TABLE orders ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1));
    CREATE UNIQUE INDEX idx_orders_messenger_ref ON orders (external_ref)
      WHERE source = 'MESSENGER' AND external_ref IS NOT NULL;

    CREATE TABLE messenger_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES orders (id),
      external_ref TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PREPARING', 'CONFIRMED', 'DELIVERED', 'CANCELLED')),
      created_at TEXT NOT NULL,
      processed_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      result TEXT CHECK (result IS NULL OR result IN ('DELIVERED', 'OUTSIDE_WINDOW', 'SEND_FAILED', 'UNKNOWN_ORDER'))
    );
    CREATE INDEX idx_messenger_outbox_pending ON messenger_outbox (processed_at, created_at);
    CREATE INDEX idx_messenger_outbox_order ON messenger_outbox (order_id);
  `,
};
