import { Migration } from './migration.types';

/**
 * Historique des réponses Facebook. La file messenger_outbox devient messenger_replies :
 * chaque réponse garde son type (dont UNAVAILABLE, « Produit indisponible actuellement. »),
 * son origine (automatique après vérification du stock, ou changement de statut par le vendeur),
 * le texte exact envoyé au client et le résultat de l'envoi.
 */
export const messengerReplies: Migration = {
  version: 7,
  name: 'messenger-replies',
  sql: `
    CREATE TABLE messenger_replies (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL REFERENCES orders (id),
      external_ref TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('CONFIRMED', 'UNAVAILABLE', 'PREPARING', 'DELIVERED', 'CANCELLED')),
      automatic INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0, 1)),
      details_json TEXT,
      message_text TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      result TEXT CHECK (result IS NULL OR result IN ('DELIVERED', 'OUTSIDE_WINDOW', 'SEND_FAILED', 'UNKNOWN_ORDER'))
    );
    INSERT INTO messenger_replies (id, order_id, external_ref, kind, automatic, created_at, processed_at, attempts, result)
    SELECT id, order_id, external_ref, status, 0, created_at, processed_at, attempts, result FROM messenger_outbox;
    DROP TABLE messenger_outbox;
    CREATE INDEX idx_messenger_replies_pending ON messenger_replies (processed_at, created_at);
    CREATE INDEX idx_messenger_replies_order ON messenger_replies (order_id, created_at);
  `,
};
