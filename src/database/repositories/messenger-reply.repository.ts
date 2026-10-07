import {
  CUSTOMER_REPLY_KINDS,
  CustomerReply,
  CustomerReplyEntry,
  CustomerReplyKind,
  CustomerReplyResult,
  EntityId,
  UnavailableItem,
} from '@/models';
import { nowIso } from '@/utils/date.utils';
import { generateId } from '@/utils/id.utils';
import { database } from '../database';
import { readEnum, readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow } from '../sql.types';

const RESULTS = ['DELIVERED', 'OUTSIDE_WINDOW', 'SEND_FAILED', 'UNKNOWN_ORDER'] as const;

/** Après ce nombre d'échecs réseau, l'envoi est abandonné (affiché comme échec). */
export const MAX_REPLY_ATTEMPTS = 5;

/** Réponse en attente d'envoi au backend. */
export interface PendingReply {
  readonly id: string;
  readonly externalRef: string;
  readonly kind: CustomerReplyKind;
  readonly unavailable: readonly UnavailableItem[];
  /** Texte du vendeur à envoyer tel quel (MANUAL). */
  readonly messageText: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUnavailable(json: string | null): UnavailableItem[] {
  if (json === null) {
    return [];
  }
  const value: unknown = JSON.parse(json);
  const items = isRecord(value) && Array.isArray(value['unavailable']) ? value['unavailable'] : [];
  return items.flatMap((item: unknown) =>
    isRecord(item) &&
    typeof item['productName'] === 'string' &&
    typeof item['requested'] === 'number' &&
    typeof item['available'] === 'number'
      ? [{ productName: item['productName'], requested: item['requested'], available: item['available'] }]
      : [],
  );
}

function toReply(row: SqlRow): CustomerReply {
  const result = readNullableString(row, 'result');
  return {
    id: readString(row, 'id'),
    orderId: readString(row, 'order_id'),
    kind: readEnum(row, 'kind', CUSTOMER_REPLY_KINDS),
    automatic: readNumber(row, 'automatic') === 1,
    messageText: readNullableString(row, 'message_text'),
    createdAt: readString(row, 'created_at'),
    result: result === null ? null : readEnum(row, 'result', RESULTS),
  };
}

/** Réponses Facebook : file d'envoi (hors ligne) et historique. */
export const messengerReplyRepository = {
  async enqueue(
    input: {
      readonly orderId: EntityId;
      readonly externalRef: string;
      readonly kind: CustomerReplyKind;
      readonly automatic: boolean;
      readonly unavailable?: readonly UnavailableItem[];
      /** Message écrit par le vendeur (MANUAL), gardé dès la mise en file. */
      readonly messageText?: string;
    },
    executor: SqlExecutor = database,
  ): Promise<void> {
    await executor.run(
      `INSERT INTO messenger_replies (id, order_id, external_ref, kind, automatic, details_json, message_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        input.orderId,
        input.externalRef,
        input.kind,
        input.automatic ? 1 : 0,
        input.unavailable === undefined || input.unavailable.length === 0
          ? null
          : JSON.stringify({ unavailable: input.unavailable }),
        input.messageText ?? null,
        nowIso(),
      ],
    );
  },

  async findPending(): Promise<PendingReply[]> {
    const rows = await database.select(
      'SELECT * FROM messenger_replies WHERE processed_at IS NULL ORDER BY created_at ASC, rowid ASC',
    );
    return rows.map((row) => ({
      id: readString(row, 'id'),
      externalRef: readString(row, 'external_ref'),
      kind: readEnum(row, 'kind', CUSTOMER_REPLY_KINDS),
      unavailable: parseUnavailable(readNullableString(row, 'details_json')),
      messageText: readNullableString(row, 'message_text'),
    }));
  },

  async markProcessed(id: string, result: CustomerReplyResult, messageText: string | null): Promise<void> {
    await database.run(
      `UPDATE messenger_replies SET processed_at = ?, result = ?, message_text = COALESCE(?, message_text),
         attempts = attempts + 1 WHERE id = ?`,
      [nowIso(), result, messageText, id],
    );
  },

  async markAttemptFailed(id: string): Promise<void> {
    await database.run(
      `UPDATE messenger_replies SET attempts = attempts + 1,
         processed_at = CASE WHEN attempts + 1 >= ? THEN ? ELSE NULL END,
         result = CASE WHEN attempts + 1 >= ? THEN 'SEND_FAILED' ELSE NULL END
       WHERE id = ?`,
      [MAX_REPLY_ATTEMPTS, nowIso(), MAX_REPLY_ATTEMPTS, id],
    );
  },

  async findByOrder(orderId: EntityId): Promise<CustomerReply[]> {
    const rows = await database.select(
      'SELECT * FROM messenger_replies WHERE order_id = ? ORDER BY created_at DESC, rowid DESC',
      [orderId],
    );
    return rows.map(toReply);
  },

  /** Historique global, plus récent d'abord, avec la référence de commande et le client. */
  async findRecent(limit = 200): Promise<CustomerReplyEntry[]> {
    const rows = await database.select(
      `SELECT r.*, o.reference AS order_reference, c.name AS client_name
       FROM messenger_replies AS r
       JOIN orders AS o ON o.id = r.order_id
       LEFT JOIN clients AS c ON c.id = o.client_id
       ORDER BY r.created_at DESC, r.rowid DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((row) => ({
      reply: toReply(row),
      orderReference: readString(row, 'order_reference'),
      clientName: readNullableString(row, 'client_name'),
    }));
  },
};
