import { createHash, randomUUID } from 'node:crypto';
import { DEFAULT_LANG, isLang } from '../domain/i18n.ts';
import {
  type CartItem,
  type CatalogProduct,
  type ConversationState,
  type ConversationStep,
  CUSTOMER_ORDER_STATUSES,
  type CustomerOrderStatus,
  type DeliveryStatus,
  type DraftItem,
  type DraftMode,
  INITIAL_CONVERSATION,
  type MessageKind,
  NOTIFICATION_EVENTS,
  type OrderDraft,
  type QuickReply,
  type ReplyRecord,
} from '../domain/types.ts';
import { dayPrefix } from '../shared/format.ts';
import { readNullableString, readNumber, readString, type Row, type SqlDb } from './sql.ts';

const now = (): string => new Date().toISOString();

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// --- Lecture défensive des colonnes JSON ------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStep(value: unknown): ConversationStep {
  if (!isRecord(value)) {
    return { kind: 'IDLE' };
  }
  const kind = value['kind'];
  if (kind === 'CHOOSING_PRODUCT' && typeof value['page'] === 'number') {
    return { kind, page: value['page'] };
  }
  if (kind === 'CHOOSING_QUANTITY' && typeof value['productId'] === 'string') {
    return { kind, productId: value['productId'] };
  }
  return kind === 'CART' ? { kind } : { kind: 'IDLE' };
}

function parseCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item: unknown) =>
    isRecord(item) && typeof item['productId'] === 'string' && typeof item['quantity'] === 'number'
      ? [{ productId: item['productId'], quantity: item['quantity'] }]
      : [],
  );
}

function parseState(json: string): ConversationState {
  try {
    const value: unknown = JSON.parse(json);
    if (!isRecord(value)) {
      return INITIAL_CONVERSATION;
    }
    const rawTexts = Array.isArray(value['rawTexts'])
      ? value['rawTexts'].filter((text: unknown): text is string => typeof text === 'string')
      : [];
    const unparsedText = typeof value['unparsedText'] === 'string' ? value['unparsedText'] : null;
    const lang = isLang(value['lang']) ? value['lang'] : DEFAULT_LANG;
    const choices = Array.isArray(value['choices'])
      ? value['choices'].flatMap((choice: unknown) =>
          isRecord(choice) && typeof choice['title'] === 'string' && typeof choice['payload'] === 'string'
            ? [{ title: choice['title'], payload: choice['payload'] }]
            : [],
        )
      : [];
    return { step: parseStep(value['step']), cart: parseCart(value['cart']), rawTexts, unparsedText, lang, choices };
  } catch {
    return INITIAL_CONVERSATION;
  }
}

function parseItems(json: string): DraftItem[] {
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item: unknown) =>
    isRecord(item) &&
    typeof item['productId'] === 'string' &&
    typeof item['productName'] === 'string' &&
    typeof item['quantity'] === 'number' &&
    typeof item['unitPrice'] === 'number'
      ? [
          {
            productId: item['productId'],
            productName: item['productName'],
            quantity: item['quantity'],
            unitPrice: item['unitPrice'],
          },
        ]
      : [],
  );
}

function toDraft(row: Row): OrderDraft {
  const mode = readString(row, 'mode');
  return {
    id: readString(row, 'id'),
    reference: readString(row, 'reference'),
    psid: readString(row, 'psid'),
    customerName: readNullableString(row, 'customer_name'),
    mode: mode === 'GUIDED' || mode === 'TEXT' ? mode : 'RAW',
    items: parseItems(readString(row, 'items_json')),
    rawText: readNullableString(row, 'raw_text'),
    needsReview: readNumber(row, 'needs_review') === 1,
    createdAt: readString(row, 'created_at'),
    customerStatus: CUSTOMER_ORDER_STATUSES.find((status) => status === row['customer_status']) ?? 'RECEIVED',
    customerStatusAt: readNullableString(row, 'customer_status_at'),
  };
}

const MESSAGE_KINDS: readonly MessageKind[] = ['CONVERSATION', 'RECEIPT', 'STATUS_REPLY', ...NOTIFICATION_EVENTS];
const DELIVERY_STATUSES: readonly DeliveryStatus[] = ['SENT', 'SIMULATED', 'FAILED', 'OUTSIDE_WINDOW'];

function toReply(row: Row): ReplyRecord {
  return {
    id: readNumber(row, 'id'),
    draftId: readNullableString(row, 'draft_id'),
    kind: MESSAGE_KINDS.find((kind) => kind === row['kind']) ?? 'CONVERSATION',
    text: readString(row, 'text'),
    status: DELIVERY_STATUSES.find((status) => status === row['status']) ?? 'FAILED',
    error: readNullableString(row, 'error'),
    createdAt: readString(row, 'created_at'),
  };
}

// --- Repositories (asynchrones : SQLite de Node ou Cloudflare D1) ---------------------------

export interface Conversation {
  readonly psid: string;
  readonly customerName: string | null;
  readonly state: ConversationState;
  readonly lastCustomerMessageAt: string | null;
}

export function createRepositories(db: SqlDb) {
  return {
    catalog: {
      /** Remplace tout le catalogue par celui envoyé par l'application (atomique). */
      async replaceAll(products: readonly CatalogProduct[]): Promise<void> {
        const timestamp = now();
        await db.batch([
          { sql: 'DELETE FROM catalog_products', params: [] },
          ...products.map((p) => ({
            sql: `INSERT INTO catalog_products (id, name, sku, unit_price, available, description, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            params: [p.id, p.name, p.sku, p.unitPrice, p.available, p.description, timestamp],
          })),
        ]);
      },
      async findAll(): Promise<CatalogProduct[]> {
        const rows = await db.all('SELECT * FROM catalog_products ORDER BY name COLLATE NOCASE');
        return rows.map((row) => ({
          id: readString(row, 'id'),
          name: readString(row, 'name'),
          sku: readNullableString(row, 'sku'),
          unitPrice: readNumber(row, 'unit_price'),
          available: readNumber(row, 'available'),
          description: readNullableString(row, 'description'),
        }));
      },
    },

    conversations: {
      async find(psid: string): Promise<Conversation | null> {
        const row = await db.first('SELECT * FROM conversations WHERE psid = ?', [psid]);
        return row === null
          ? null
          : {
              psid,
              customerName: readNullableString(row, 'customer_name'),
              state: parseState(readString(row, 'state_json')),
              lastCustomerMessageAt: readNullableString(row, 'last_customer_message_at'),
            };
      },
      /** Conversations dont le dernier message client date de [from, to] et pas encore relancées depuis. */
      async findReminderCandidates(from: string, to: string): Promise<Conversation[]> {
        const rows = await db.all(
          `SELECT * FROM conversations WHERE last_customer_message_at BETWEEN ? AND ?
             AND (reminded_at IS NULL OR reminded_at < last_customer_message_at)`,
          [from, to],
        );
        return rows.map((row) => ({
          psid: readString(row, 'psid'),
          customerName: readNullableString(row, 'customer_name'),
          state: parseState(readString(row, 'state_json')),
          lastCustomerMessageAt: readNullableString(row, 'last_customer_message_at'),
        }));
      },
      async markReminded(psid: string, at: string): Promise<void> {
        await db.run('UPDATE conversations SET reminded_at = ? WHERE psid = ?', [at, psid]);
      },
      async save(conversation: Conversation): Promise<void> {
        await db.run(
          `INSERT INTO conversations (psid, customer_name, state_json, last_customer_message_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (psid) DO UPDATE SET customer_name = excluded.customer_name, state_json = excluded.state_json,
             last_customer_message_at = excluded.last_customer_message_at, updated_at = excluded.updated_at`,
          [
            conversation.psid,
            conversation.customerName,
            JSON.stringify(conversation.state),
            conversation.lastCustomerMessageAt,
            now(),
          ],
        );
      },
    },

    inboundEvents: {
      /** Enregistre l'événement ; false s'il a déjà été reçu (renvoi du webhook par Meta). */
      async register(eventId: string, psid: string, kind: string, content: string | null): Promise<boolean> {
        const result = await db.run(
          `INSERT INTO inbound_events (event_id, psid, kind, content, received_at)
           VALUES (?, ?, ?, ?, ?) ON CONFLICT (event_id) DO NOTHING`,
          [eventId, psid, kind, content, now()],
        );
        return result.changes === 1;
      },
      async markProcessed(eventId: string, error: string | null): Promise<void> {
        await db.run('UPDATE inbound_events SET processed_at = ?, error = ? WHERE event_id = ?', [now(), error, eventId]);
      },
    },

    drafts: {
      async create(input: {
        psid: string;
        customerName: string | null;
        mode: DraftMode;
        items: readonly DraftItem[];
        rawText: string | null;
        needsReview: boolean;
      }): Promise<OrderDraft> {
        const createdAt = new Date();
        const prefix = dayPrefix('MSG', createdAt);
        const countRow = await db.first('SELECT COUNT(*) AS total FROM order_drafts WHERE reference LIKE ?', [`${prefix}%`]);
        const count = countRow === null ? 0 : readNumber(countRow, 'total');
        const id = randomUUID();
        await db.run(
          `INSERT INTO order_drafts (id, reference, psid, customer_name, mode, items_json, raw_text, needs_review, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            `${prefix}${String(count + 1).padStart(3, '0')}`,
            input.psid,
            input.customerName,
            input.mode,
            JSON.stringify(input.items),
            input.rawText,
            input.needsReview ? 1 : 0,
            createdAt.toISOString(),
          ],
        );
        const row = await db.first('SELECT * FROM order_drafts WHERE id = ?', [id]);
        if (row === null) {
          throw new Error('Commande Messenger introuvable après création.');
        }
        return toDraft(row);
      },
      /** Commandes pas encore confirmées comme reçues par l'application. */
      /** Produits les plus commandés sur Messenger depuis `since` (quantités cumulées), du plus au moins demandé. */
      async popularProductIds(since: string, limit: number): Promise<string[]> {
        const rows = await db.all('SELECT items_json FROM order_drafts WHERE created_at >= ?', [since]);
        const totals = new Map<string, number>();
        for (const row of rows) {
          for (const item of parseItems(readString(row, 'items_json'))) {
            totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
          }
        }
        return [...totals].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
      },
      async findPending(): Promise<OrderDraft[]> {
        const rows = await db.all('SELECT * FROM order_drafts WHERE delivered_at IS NULL ORDER BY created_at ASC');
        return rows.map(toDraft);
      },
      async findById(id: string): Promise<OrderDraft | null> {
        const row = await db.first('SELECT * FROM order_drafts WHERE id = ?', [id]);
        return row === null ? null : toDraft(row);
      },
      /** Dernière commande du client (réponse à « statut ? »). */
      /** Produits déjà commandés par ce client, du plus récent au plus ancien (sans doublon). */
      async productIdsOrderedBy(psid: string): Promise<string[]> {
        const rows = await db.all('SELECT items_json FROM order_drafts WHERE psid = ? ORDER BY created_at DESC LIMIT 20', [psid]);
        const ids = rows.flatMap((row) => parseItems(readString(row, 'items_json')).map((item) => item.productId));
        return [...new Set(ids)];
      },
      async findLatestByPsid(psid: string): Promise<OrderDraft | null> {
        const row = await db.first('SELECT * FROM order_drafts WHERE psid = ? ORDER BY created_at DESC LIMIT 1', [psid]);
        return row === null ? null : toDraft(row);
      },
      async setCustomerStatus(id: string, status: CustomerOrderStatus): Promise<void> {
        await db.run('UPDATE order_drafts SET customer_status = ?, customer_status_at = ? WHERE id = ?', [
          status,
          now(),
          id,
        ]);
      },
      /** Marque les commandes comme récupérées par l'application ; renvoie le nombre réellement marqué. */
      async markDelivered(ids: readonly string[]): Promise<number> {
        const pending = await Promise.all(
          ids.map((id) => db.first('SELECT id FROM order_drafts WHERE id = ? AND delivered_at IS NULL', [id])),
        );
        const toMark = ids.filter((_, index) => pending[index] !== null);
        const timestamp = now();
        await db.batch(
          toMark.map((id) => ({ sql: 'UPDATE order_drafts SET delivered_at = ? WHERE id = ?', params: [timestamp, id] })),
        );
        return toMark.length;
      },
    },

    devices: {
      async create(name: string): Promise<{ id: string; token: string }> {
        const id = randomUUID();
        const token = `${randomUUID()}${randomUUID()}`.replace(/-/g, '');
        await db.run('INSERT INTO devices (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)', [
          id,
          name,
          hashToken(token),
          now(),
        ]);
        return { id, token };
      },
      /** Appareil actif correspondant au jeton, ou null. Met à jour la date de dernière activité. */
      async authenticate(token: string): Promise<string | null> {
        const row = await db.first('SELECT id FROM devices WHERE token_hash = ? AND revoked_at IS NULL', [hashToken(token)]);
        if (row === null) {
          return null;
        }
        const id = readString(row, 'id');
        await db.run('UPDATE devices SET last_seen_at = ? WHERE id = ?', [now(), id]);
        return id;
      },
      async revoke(id: string): Promise<void> {
        await db.run('UPDATE devices SET revoked_at = ?, push_token = NULL WHERE id = ?', [now(), id]);
      },
      /** Jeton Expo Push de l'appareil (null : ne plus envoyer de notification). */
      async setPushToken(id: string, pushToken: string | null): Promise<void> {
        await db.run('UPDATE devices SET push_token = ? WHERE id = ?', [pushToken, id]);
      },
      /** Appareils actifs qui acceptent les notifications push. */
      async findPushTargets(): Promise<{ id: string; pushToken: string }[]> {
        const rows = await db.all('SELECT id, push_token FROM devices WHERE revoked_at IS NULL AND push_token IS NOT NULL');
        return rows.map((row) => ({ id: readString(row, 'id'), pushToken: readString(row, 'push_token') }));
      },
    },

    outgoing: {
      async log(entry: {
        psid: string;
        text: string;
        quickReplies?: readonly QuickReply[];
        status: DeliveryStatus;
        error?: string | null;
        draftId?: string | null;
        kind?: MessageKind;
      }): Promise<void> {
        await db.run(
          `INSERT INTO outgoing_messages (psid, text, quick_replies_json, created_at, status, error, draft_id, kind)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.psid,
            entry.text,
            entry.quickReplies === undefined ? null : JSON.stringify(entry.quickReplies),
            now(),
            entry.status,
            entry.error ?? null,
            entry.draftId ?? null,
            entry.kind ?? 'CONVERSATION',
          ],
        );
      },
      /** Historique des réponses liées à une commande, de la plus ancienne à la plus récente. */
      async findByDraft(draftId: string): Promise<ReplyRecord[]> {
        const rows = await db.all('SELECT * FROM outgoing_messages WHERE draft_id = ? ORDER BY id ASC', [draftId]);
        return rows.map(toReply);
      },
      async findRecent(
        psid: string,
        afterId: number,
      ): Promise<{ id: number; text: string; quickReplies: string[]; status: string }[]> {
        const rows = await db.all('SELECT * FROM outgoing_messages WHERE psid = ? AND id > ? ORDER BY id ASC', [
          psid,
          afterId,
        ]);
        return rows.map((row) => {
          const json = readNullableString(row, 'quick_replies_json');
          const replies: unknown = json === null ? [] : JSON.parse(json);
          return {
            id: readNumber(row, 'id'),
            text: readString(row, 'text'),
            quickReplies: Array.isArray(replies)
              ? replies.flatMap((reply: unknown) =>
                  isRecord(reply) && typeof reply['title'] === 'string' && typeof reply['payload'] === 'string'
                    ? [`${reply['title']} [${reply['payload']}]`]
                    : [],
                )
              : [],
            status: readString(row, 'status'),
          };
        });
      },
      async lastId(): Promise<number> {
        const row = await db.first('SELECT COALESCE(MAX(id), 0) AS last FROM outgoing_messages');
        return row === null ? 0 : readNumber(row, 'last');
      },
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
