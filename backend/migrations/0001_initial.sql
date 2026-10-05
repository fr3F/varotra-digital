-- Schéma initial du backend Messenger (le stock et les commandes de référence restent dans l'application).

CREATE TABLE conversations (
  psid TEXT PRIMARY KEY NOT NULL,
  customer_name TEXT,
  state_json TEXT NOT NULL,
  last_customer_message_at TEXT,
  updated_at TEXT NOT NULL
);

-- Un événement Messenger n'est traité qu'une fois (Meta peut renvoyer un webhook).
CREATE TABLE inbound_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  psid TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  error TEXT
);

-- Commandes construites à partir des conversations, en attente de récupération par l'application.
CREATE TABLE order_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  psid TEXT NOT NULL,
  customer_name TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('GUIDED', 'TEXT', 'RAW')),
  items_json TEXT NOT NULL,
  raw_text TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX idx_order_drafts_pending ON order_drafts (delivered_at, created_at);

-- Copie du catalogue envoyée par l'application (produits, prix, quantités disponibles).
CREATE TABLE catalog_products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  unit_price INTEGER NOT NULL,
  available INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- Appareils reliés par code d'appairage ; seul le hachage du jeton est conservé.
CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

-- Journal des messages envoyés aux clients (audit, et lecture par le simulateur en dev).
CREATE TABLE outgoing_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  psid TEXT NOT NULL,
  text TEXT NOT NULL,
  quick_replies_json TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'SIMULATED', 'FAILED', 'OUTSIDE_WINDOW')),
  error TEXT
);
CREATE INDEX idx_outgoing_psid ON outgoing_messages (psid, id);
