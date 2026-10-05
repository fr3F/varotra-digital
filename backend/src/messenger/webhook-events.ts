import type { IncomingMessage } from '../domain/conversation-engine.ts';

/** Événement Messenger utile, extrait d'un webhook « page ». */
export interface MessengerEvent {
  /** Identifiant unique (mid du message) : sert à ignorer les renvois du même webhook. */
  readonly eventId: string;
  /** Identifiant du client propre à la Page (PSID). */
  readonly psid: string;
  readonly timestamp: number;
  readonly message: IncomingMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseMessaging(item: unknown): MessengerEvent | null {
  if (!isRecord(item) || !isRecord(item['sender'])) {
    return null;
  }
  const psid = asString(item['sender']['id']);
  const timestamp = typeof item['timestamp'] === 'number' ? item['timestamp'] : Date.now();
  if (psid === null) {
    return null;
  }

  const postback = item['postback'];
  if (isRecord(postback)) {
    const payload = asString(postback['payload']);
    if (payload === null) {
      return null;
    }
    // Un postback n'a pas toujours de mid : identifiant reconstruit, stable pour un même envoi.
    const eventId = asString(postback['mid']) ?? `postback:${psid}:${timestamp}:${payload}`;
    return { eventId, psid, timestamp, message: { kind: 'POSTBACK', payload } };
  }

  const message = item['message'];
  if (!isRecord(message) || message['is_echo'] === true) {
    // Accusés de lecture/livraison et messages envoyés par la Page elle-même : ignorés.
    return null;
  }
  const mid = asString(message['mid']);
  if (mid === null) {
    return null;
  }
  const text = asString(message['text']);
  const quickReply = message['quick_reply'];
  if (isRecord(quickReply)) {
    const payload = asString(quickReply['payload']);
    if (payload !== null) {
      return { eventId: mid, psid, timestamp, message: { kind: 'QUICK_REPLY', payload, text: text ?? '' } };
    }
  }
  return {
    eventId: mid,
    psid,
    timestamp,
    message: text === null ? { kind: 'UNSUPPORTED' } : { kind: 'TEXT', text },
  };
}

/** Extrait les événements utiles d'un webhook Messenger (objet « page »). Le reste est ignoré. */
export function parseWebhookBody(body: unknown): MessengerEvent[] {
  if (!isRecord(body) || body['object'] !== 'page' || !Array.isArray(body['entry'])) {
    return [];
  }
  return body['entry'].flatMap((entry: unknown) => {
    if (!isRecord(entry) || !Array.isArray(entry['messaging'])) {
      return [];
    }
    return entry['messaging'].flatMap((item: unknown) => {
      const event = parseMessaging(item);
      return event === null ? [] : [event];
    });
  });
}
