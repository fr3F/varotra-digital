-- Plusieurs boutiques sur le même serveur : chacune a sa Page Facebook, son abonnement,
-- ses téléphones, son catalogue, ses conversations et ses commandes. Les données existantes
-- deviennent la boutique « default » (ancienne configuration à une seule Page).

CREATE TABLE shops (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  -- Code remis au vendeur après paiement : il le saisit dans l'application.
  activation_code TEXT NOT NULL UNIQUE,
  page_id TEXT UNIQUE,
  page_name TEXT,
  page_access_token TEXT,
  expires_at TEXT NOT NULL,
  suspended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO shops (id, name, activation_code, expires_at, created_at, updated_at)
VALUES ('default', 'Boutique principale', 'DEFAULT-' || lower(hex(randomblob(8))), '2099-12-31T00:00:00.000Z',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

ALTER TABLE catalog_products ADD COLUMN shop_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX idx_catalog_shop ON catalog_products (shop_id);
ALTER TABLE conversations ADD COLUMN shop_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX idx_conversations_shop ON conversations (shop_id, last_customer_message_at);
ALTER TABLE inbound_events ADD COLUMN shop_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE devices ADD COLUMN shop_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX idx_devices_shop ON devices (shop_id);
ALTER TABLE outgoing_messages ADD COLUMN shop_id TEXT NOT NULL DEFAULT 'default';

-- Références MSG-AAAAMMJJ-001 propres à chaque boutique : l'unicité devient (boutique, référence).
CREATE TABLE order_drafts_new (
  id TEXT PRIMARY KEY NOT NULL,
  shop_id TEXT NOT NULL DEFAULT 'default',
  reference TEXT NOT NULL,
  psid TEXT NOT NULL,
  customer_name TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('GUIDED', 'TEXT', 'RAW')),
  items_json TEXT NOT NULL,
  raw_text TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  customer_status TEXT NOT NULL DEFAULT 'RECEIVED',
  customer_status_at TEXT,
  phone TEXT,
  address TEXT,
  delivery_zone TEXT,
  delivery_fee INTEGER,
  UNIQUE (shop_id, reference)
);
INSERT INTO order_drafts_new (id, reference, psid, customer_name, mode, items_json, raw_text, needs_review, created_at,
  delivered_at, customer_status, customer_status_at, phone, address, delivery_zone, delivery_fee)
SELECT id, reference, psid, customer_name, mode, items_json, raw_text, needs_review, created_at,
  delivered_at, customer_status, customer_status_at, phone, address, delivery_zone, delivery_fee
FROM order_drafts;
DROP TABLE order_drafts;
ALTER TABLE order_drafts_new RENAME TO order_drafts;
CREATE INDEX idx_order_drafts_pending ON order_drafts (shop_id, delivered_at, created_at);
CREATE INDEX idx_order_drafts_psid ON order_drafts (psid, created_at);

-- Réglages par boutique (frais de livraison…).
CREATE TABLE settings_new (
  shop_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (shop_id, key)
);
INSERT INTO settings_new (shop_id, key, value, updated_at) SELECT 'default', key, value, updated_at FROM settings;
DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;

-- Connexion Facebook en cours (10 minutes) : relie le retour de Facebook à la boutique.
CREATE TABLE oauth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  shop_id TEXT NOT NULL,
  user_token TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
