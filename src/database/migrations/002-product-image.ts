import { Migration } from './migration.types';

/** Ajoute l'image du produit : URI d'un fichier local (mobile) ou data URI (web). */
export const productImage: Migration = {
  version: 2,
  name: 'product-image',
  sql: `
    ALTER TABLE products ADD COLUMN image_uri TEXT;
    CREATE INDEX idx_products_category ON products (category) WHERE deleted_at IS NULL;
  `,
};
