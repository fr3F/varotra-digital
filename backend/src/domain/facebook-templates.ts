import { formatMoney, normalizeText } from '../shared/format.ts';
import { DEFAULT_LANG, type Lang, MESSAGES } from './i18n.ts';
import type { NotificationEvent, OrderDraft, UnavailableItem } from './types.ts';

/** Phrases imposées pour la réponse automatique après vérification du stock (version française). */
export const AUTO_REPLY = {
  confirmed: MESSAGES.fr.confirmed,
  unavailable: MESSAGES.fr.unavailable,
} as const;

function orderTotal(draft: OrderDraft): number {
  return draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function unavailableLines(items: readonly UnavailableItem[], lang: Lang): string {
  const messages = MESSAGES[lang];
  return items
    .map((item) =>
      item.available > 0
        ? messages.unavailableLine(item.productName, item.available, item.requested)
        : messages.soldOutLine(item.productName),
    )
    .join('\n');
}

export interface NotificationDetails {
  readonly unavailable?: readonly UnavailableItem[];
  readonly note?: string | null;
}

/** Texte envoyé au client pour un événement de sa commande, dans sa langue. */
export function notificationText(
  event: NotificationEvent,
  draft: OrderDraft,
  details: NotificationDetails = {},
  lang: Lang = DEFAULT_LANG,
): string {
  const messages = MESSAGES[lang];
  const body: Record<NotificationEvent, string> = {
    CONFIRMED: `${messages.confirmed}\n${messages.reference} ${draft.reference} — ${messages.total(formatMoney(orderTotal(draft)))}`,
    UNAVAILABLE: [
      messages.unavailable,
      details.unavailable !== undefined && details.unavailable.length > 0 ? unavailableLines(details.unavailable, lang) : null,
      messages.unavailableFooter(draft.reference),
    ]
      .filter((part): part is string => part !== null)
      .join('\n'),
    PREPARING: messages.preparing(draft.reference),
    DELIVERED: messages.delivered(draft.reference),
    CANCELLED: messages.cancelled(draft.reference),
  };
  const note = details.note?.trim();
  return note === undefined || note.length === 0 ? body[event] : `${body[event]}\n${note}`;
}

/** Réponse à « statut ? » : où en est la dernière commande du client. */
export function statusInquiryText(draft: OrderDraft, lang: Lang = DEFAULT_LANG): string {
  const messages = MESSAGES[lang];
  return messages.statusInquiry(draft.reference, formatMoney(orderTotal(draft)), messages.statusLabels[draft.customerStatus]);
}

/** Mots par lesquels un client demande où en est sa commande (français, malgache, anglais). */
const STATUS_WORDS = new Set(['statut', 'status', 'suivi', 'aiza', 'vonona', 'tracking', 'oviana']);
const STATUS_PHRASES = [
  'ma commande', 'mon colis', 'ou en est', 'ny kaomandiko', 'ny entako', 'ny baikoko', 'my order', 'where is',
];

export function isStatusInquiry(text: string): boolean {
  const normalized = normalizeText(text);
  return normalized.split(' ').some((word) => STATUS_WORDS.has(word)) || STATUS_PHRASES.some((phrase) => normalized.includes(phrase));
}
