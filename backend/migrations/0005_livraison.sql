-- Livraison : le bot demande le téléphone et l'adresse avant d'enregistrer la commande ;
-- frais fixe dans Antananarivo (réglé depuis l'application), à convenir ailleurs.
ALTER TABLE order_drafts ADD COLUMN phone TEXT;
ALTER TABLE order_drafts ADD COLUMN address TEXT;
ALTER TABLE order_drafts ADD COLUMN delivery_zone TEXT;
ALTER TABLE order_drafts ADD COLUMN delivery_fee INTEGER;

-- Réglages envoyés par l'application (clé → valeur).
CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
