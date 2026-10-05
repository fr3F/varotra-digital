export const APP_NAME = 'Carnet Digital';

export const DATABASE_NAME = 'carnet_digital.db';

/** Devise affichée. Les montants sont stockés en entiers (unité minimale de la devise). */
export const CURRENCY = {
  code: 'MGA',
  symbol: 'Ar',
} as const;

export const DEFAULT_STOCK_ALERT_THRESHOLD = 5;

/** Segment de route utilisé pour les écrans de création (ex: /products/new). */
export const NEW_ENTITY_ID = 'new';

/** Serveur Messenger déployé sur Cloudflare (proposé par défaut dans Réglages › Messenger). */
export const DEFAULT_MESSENGER_BACKEND_URL = 'https://carnet-digital-backend.fb-page-bot.workers.dev';
