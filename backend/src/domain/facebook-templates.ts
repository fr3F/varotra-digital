import { formatMoney, normalizeText } from '../shared/format.ts';
import type { CustomerOrderStatus, NotificationEvent, OrderDraft, UnavailableItem } from './types.ts';

/** Phrases imposées pour la réponse automatique après vérification du stock. */
export const AUTO_REPLY = {
  confirmed: 'Votre commande est confirmée.',
  unavailable: 'Produit indisponible actuellement.',
} as const;

function orderTotal(draft: OrderDraft): number {
  return draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function unavailableLines(items: readonly UnavailableItem[]): string {
  return items
    .map((item) =>
      item.available > 0
        ? `• ${item.productName} : ${item.available} disponible(s) sur ${item.requested} demandé(s)`
        : `• ${item.productName} : épuisé`,
    )
    .join('\n');
}

export interface NotificationDetails {
  readonly unavailable?: readonly UnavailableItem[];
  readonly note?: string | null;
}

/** Texte envoyé au client pour un événement de sa commande. */
export function notificationText(event: NotificationEvent, draft: OrderDraft, details: NotificationDetails = {}): string {
  const body: Record<NotificationEvent, string> = {
    CONFIRMED: `${AUTO_REPLY.confirmed}\nRéf. ${draft.reference} — Total : ${formatMoney(orderTotal(draft))}`,
    UNAVAILABLE: [
      AUTO_REPLY.unavailable,
      details.unavailable !== undefined && details.unavailable.length > 0 ? unavailableLines(details.unavailable) : null,
      `Réf. ${draft.reference} — nous vous recontactons dès que possible.`,
    ]
      .filter((part): part is string => part !== null)
      .join('\n'),
    PREPARING: `Votre commande ${draft.reference} est en préparation 📦`,
    DELIVERED: `Votre commande ${draft.reference} a été livrée. Merci pour votre confiance 🙏`,
    CANCELLED: `Votre commande ${draft.reference} a été annulée. N’hésitez pas à nous écrire pour toute question.`,
  };
  const note = details.note?.trim();
  return note === undefined || note.length === 0 ? body[event] : `${body[event]}\n${note}`;
}

const STATUS_LABELS: Readonly<Record<CustomerOrderStatus, string>> = {
  RECEIVED: 'reçue, en attente de confirmation par le vendeur',
  CONFIRMED: 'confirmée ✅',
  UNAVAILABLE: 'en attente : un produit est indisponible actuellement',
  PREPARING: 'en préparation 📦',
  DELIVERED: 'livrée',
  CANCELLED: 'annulée',
};

/** Réponse à « statut ? » : où en est la dernière commande du client. */
export function statusInquiryText(draft: OrderDraft): string {
  return `Votre commande ${draft.reference} (${formatMoney(orderTotal(draft))}) est ${STATUS_LABELS[draft.customerStatus]}.`;
}

/** Mots par lesquels un client demande où en est sa commande (français et malgache). */
const STATUS_WORDS = new Set(['statut', 'status', 'suivi', 'aiza', 'vonona']);
const STATUS_PHRASES = ['ma commande', 'mon colis', 'ou en est', 'ny kaomandiko', 'ny entako'];

export function isStatusInquiry(text: string): boolean {
  const normalized = normalizeText(text);
  return normalized.split(' ').some((word) => STATUS_WORDS.has(word)) || STATUS_PHRASES.some((phrase) => normalized.includes(phrase));
}
