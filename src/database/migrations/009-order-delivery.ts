import { Migration } from './migration.types';

/**
 * Livraison des commandes Messenger : téléphone et adresse donnés au bot, zone et frais annoncés
 * au client (frais NULL hors d'Antananarivo : à convenir par téléphone).
 */
export const orderDelivery: Migration = {
  version: 9,
  name: 'order-delivery',
  sql: `
    ALTER TABLE orders ADD COLUMN delivery_phone TEXT;
    ALTER TABLE orders ADD COLUMN delivery_address TEXT;
    ALTER TABLE orders ADD COLUMN delivery_zone TEXT;
    ALTER TABLE orders ADD COLUMN delivery_fee INTEGER;
  `,
};
