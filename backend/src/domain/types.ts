import type { DeliveryInfo } from './delivery.ts';
import { DEFAULT_LANG, type Lang } from './i18n.ts';

/** Produit tel que l'application l'envoie au backend (copie du catalogue du téléphone). */
export interface CatalogProduct {
  /** Identifiant du produit dans l'application (UUID). */
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly unitPrice: number;
  /** Quantité disponible au moment du dernier envoi (stock - réservations). */
  readonly available: number;
  /** Description saisie dans l'application (argument de vente montré au client), ou null. */
  readonly description: string | null;
}

export interface CartItem {
  readonly productId: string;
  readonly quantity: number;
}

/** Étape de la conversation guidée avec un client. */
export type ConversationStep =
  | { readonly kind: 'IDLE' }
  | { readonly kind: 'CHOOSING_PRODUCT'; readonly page: number }
  | { readonly kind: 'CHOOSING_QUANTITY'; readonly productId: string }
  | { readonly kind: 'CART' }
  /** Panier validé : le bot demande le téléphone, puis l'adresse de livraison. */
  | { readonly kind: 'ASKING_PHONE' }
  | { readonly kind: 'ASKING_ADDRESS'; readonly phone: string };

export interface ConversationState {
  readonly step: ConversationStep;
  readonly cart: readonly CartItem[];
  /** Messages libres ayant servi à remplir le panier (transmis au vendeur). */
  readonly rawTexts: readonly string[];
  /** Dernier message non compris, que le client peut « envoyer tel quel » au vendeur. */
  readonly unparsedText: string | null;
  /** Langue du client (détectée sur ses messages) : le bot lui répond dans cette langue. */
  readonly lang: Lang;
  /** Choix de la dernière réponse, dans l'ordre affiché : le client peut répondre par leur numéro. */
  readonly choices: readonly QuickReply[];
}

export const INITIAL_CONVERSATION: ConversationState = {
  step: { kind: 'IDLE' },
  cart: [],
  rawTexts: [],
  unparsedText: null,
  lang: DEFAULT_LANG,
  choices: [],
};

export type DraftMode = 'GUIDED' | 'TEXT' | 'RAW';

export interface DraftItem {
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

/** Commande Messenger en attente de récupération par l'application. */
export interface OrderDraft {
  readonly id: string;
  readonly reference: string;
  readonly psid: string;
  readonly customerName: string | null;
  readonly mode: DraftMode;
  readonly items: readonly DraftItem[];
  readonly rawText: string | null;
  /** Le vendeur doit vérifier : message non compris, ou quantité au-delà du stock connu. */
  readonly needsReview: boolean;
  readonly createdAt: string;
  /** Dernier statut annoncé au client. */
  readonly customerStatus: CustomerOrderStatus;
  readonly customerStatusAt: string | null;
  /** Téléphone, adresse et frais annoncés (null : commande transmise telle quelle, ou ancienne commande). */
  readonly delivery: DeliveryInfo | null;
}

/** Réponse envoyée au client sur Messenger. */
export interface QuickReply {
  readonly title: string;
  readonly payload: string;
}

export interface OutgoingReply {
  readonly text: string;
  readonly quickReplies?: readonly QuickReply[];
}

/**
 * Événements que l'application signale au client. CONFIRMED et UNAVAILABLE servent aussi à la
 * réponse automatique après vérification du stock (stock disponible / insuffisant).
 */
export const NOTIFICATION_EVENTS = ['CONFIRMED', 'UNAVAILABLE', 'PREPARING', 'DELIVERED', 'CANCELLED'] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** Statut de la commande tel que le client le voit (réponse à « statut ? »). */
export const CUSTOMER_ORDER_STATUSES = ['RECEIVED', ...NOTIFICATION_EVENTS] as const;
export type CustomerOrderStatus = (typeof CUSTOMER_ORDER_STATUSES)[number];

/** Produit en quantité insuffisante, détaillé dans la réponse « Produit indisponible actuellement. ». */
export interface UnavailableItem {
  readonly productName: string;
  readonly requested: number;
  readonly available: number;
}

/** Nature d'un message envoyé au client (historique des réponses). */
/** MANUAL : message écrit par le vendeur dans l'application. */
export type MessageKind = 'CONVERSATION' | 'RECEIPT' | 'STATUS_REPLY' | 'MANUAL' | NotificationEvent;

export type DeliveryStatus = 'SENT' | 'SIMULATED' | 'FAILED' | 'OUTSIDE_WINDOW';

/** Message envoyé (ou non) à un client, rattaché éventuellement à une commande. */
export interface ReplyRecord {
  readonly id: number;
  readonly draftId: string | null;
  readonly kind: MessageKind;
  readonly text: string;
  readonly status: DeliveryStatus;
  readonly error: string | null;
  readonly createdAt: string;
}
