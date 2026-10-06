-- Bot vendeur : description des produits (envoyée par l'application) et relance unique d'un panier abandonné.
ALTER TABLE catalog_products ADD COLUMN description TEXT;
ALTER TABLE conversations ADD COLUMN reminded_at TEXT;
