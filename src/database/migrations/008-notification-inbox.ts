import { Migration } from './migration.types';

/**
 * Centre de notifications : chaque événement (nouvelle commande, commande livrée, stock bas,
 * erreur de synchronisation) est gardé ici pour être relu depuis la cloche de l'en-tête.
 */
export const notificationInbox: Migration = {
  version: 8,
  name: 'notification-inbox',
  sql: `
    CREATE TABLE app_notifications (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT
    );
    CREATE INDEX idx_app_notifications_created ON app_notifications (created_at);
  `,
};
