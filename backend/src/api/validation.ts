import type { NotificationDetails } from '../domain/facebook-templates.ts';
import { isExpoPushToken } from '../push/push-client.ts';
import { type CatalogProduct, NOTIFICATION_EVENTS, type NotificationEvent, type UnavailableItem } from '../domain/types.ts';

/** Erreur de saisie renvoyée en 400 à l'application. */
export class BadRequestError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new BadRequestError('Corps JSON attendu.');
  }
  return value;
}

function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new BadRequestError(`Champ « ${field} » invalide.`);
  }
  return value.trim();
}

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestError(`Champ « ${field} » : entier positif attendu.`);
  }
  return value;
}

export function parsePairRequest(body: unknown): { pairingCode: string; deviceName: string } {
  const value = record(body);
  return { pairingCode: text(value['pairingCode'], 'pairingCode', 100), deviceName: text(value['deviceName'], 'deviceName', 80) };
}

/** `{ pushToken: "ExponentPushToken[…]" }`, ou `{ pushToken: null }` pour désactiver les notifications. */
export function parsePushTokenRequest(body: unknown): string | null {
  const value = record(body)['pushToken'];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !isExpoPushToken(value)) {
    throw new BadRequestError('Champ « pushToken » : jeton Expo Push attendu.');
  }
  return value;
}

export function parseCatalog(body: unknown): CatalogProduct[] {
  const value = record(body);
  const products = value['products'];
  if (!Array.isArray(products) || products.length > 5000) {
    throw new BadRequestError('Champ « products » : liste attendue (5000 produits maximum).');
  }
  return products.map((item: unknown, index) => {
    const product = record(item);
    const sku = product['sku'];
    return {
      id: text(product['id'], `products[${index}].id`, 100),
      name: text(product['name'], `products[${index}].name`),
      sku: sku === null || sku === undefined ? null : text(sku, `products[${index}].sku`, 100),
      unitPrice: count(product['unitPrice'], `products[${index}].unitPrice`),
      available: count(product['available'], `products[${index}].available`),
    };
  });
}

export function parseAck(body: unknown): string[] {
  const ids = record(body)['ids'];
  if (!Array.isArray(ids) || ids.length > 500) {
    throw new BadRequestError('Champ « ids » : liste attendue (500 maximum).');
  }
  return ids.map((id: unknown, index) => text(id, `ids[${index}]`, 100));
}

/** Événement à signaler au client, avec le détail des produits indisponibles le cas échéant. */
export function parseNotifyRequest(body: unknown): { event: NotificationEvent; details: NotificationDetails } {
  const value = record(body);
  const event = NOTIFICATION_EVENTS.find((candidate) => candidate === value['event']);
  if (event === undefined) {
    throw new BadRequestError(`Champ « event » : ${NOTIFICATION_EVENTS.join(', ')} attendu.`);
  }
  const rawItems = value['unavailable'];
  if (rawItems !== undefined && (!Array.isArray(rawItems) || rawItems.length > 100)) {
    throw new BadRequestError('Champ « unavailable » : liste attendue (100 maximum).');
  }
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [];
  const unavailable: UnavailableItem[] = items.map((item, index) => {
    const entry = record(item);
    return {
      productName: text(entry['productName'], `unavailable[${index}].productName`),
      requested: count(entry['requested'], `unavailable[${index}].requested`),
      available: count(entry['available'], `unavailable[${index}].available`),
    };
  });
  const note = value['note'];
  return {
    event,
    details: { unavailable, note: note === null || note === undefined ? null : text(note, 'note', 500) },
  };
}
