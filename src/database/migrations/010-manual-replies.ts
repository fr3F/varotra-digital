import { Migration } from './migration.types';

/**
 * Messages écrits par le vendeur dans l'application (type MANUAL) : la contrainte CHECK de
 * messenger_replies ne se modifie pas en SQLite, la table est donc reconstruite à l'identique.
 */
export const manualReplies: Migration = {
  version: 10,
  name: 'manual-replies',
  sql: `
    CREATE TABLE messenger_replies_new (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES orders (id),
      external_ref TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('CONFIRMED', 'UNAVAILABLE', 'PREPARING', 'DELIVERED', 'CANCELLED', 'MANUAL')),
      automatic INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0, 1)),
      details_json TEXT,
      message_text TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      result TEXT CHECK (result IS NULL OR result IN ('DELIVERED', 'OUTSIDE_WINDOW', 'SEND_FAILED', 'UNKNOWN_ORDER'))
    );
    INSERT INTO messenger_replies_new
      (id, order_id, external_ref, kind, automatic, details_json, message_text, created_at, processed_at, attempts, result)
    SELECT id, order_id, external_ref, kind, automatic, details_json, message_text, created_at, processed_at, attempts, result
    FROM messenger_replies;
    DROP TABLE messenger_replies;
    ALTER TABLE messenger_replies_new RENAME TO messenger_replies;
    CREATE INDEX idx_messenger_replies_pending ON messenger_replies (processed_at, created_at);
    CREATE INDEX idx_messenger_replies_order ON messenger_replies (order_id, created_at);
  `,
};
