import { IsoDateString, Money } from './base.model';
import type { OrderDelivery } from './order.model';

/** Ligne d'une commande reçue via Messenger, telle que le backend la transmet. */
export interface RemoteOrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export type RemoteOrderMode = 'GUIDED' | 'TEXT' | 'RAW';

/** Coordonnées données au bot par le client avant l'enregistrement de sa commande. */
export type RemoteDelivery = OrderDelivery;

/** Commande Messenger en attente d'import. */
export interface RemoteOrder {
  /** Identifiant côté backend : devient orders.external_ref. */
  readonly id: string;
  readonly reference: string;
  readonly customer: { readonly psid: string; readonly name: string | null };
  readonly mode: RemoteOrderMode;
  readonly items: readonly RemoteOrderItem[];
  readonly rawText: string | null;
  readonly needsReview: boolean;
  readonly receivedAt: IsoDateString;
  /** null : message transmis tel quel, ou commande d'avant la demande des coordonnées. */
  readonly delivery: RemoteDelivery | null;
}

/**
 * Réponses Facebook envoyées au client. CONFIRMED / UNAVAILABLE servent à la réponse automatique
 * après vérification du stock ; les autres suivent les changements de statut faits par le vendeur ;
 * MANUAL est un message écrit par le vendeur dans l'application.
 */
export const CUSTOMER_REPLY_KINDS = ['CONFIRMED', 'UNAVAILABLE', 'PREPARING', 'DELIVERED', 'CANCELLED', 'MANUAL'] as const;
export type CustomerReplyKind = (typeof CUSTOMER_REPLY_KINDS)[number];

export const CUSTOMER_REPLY_LABELS: Readonly<Record<CustomerReplyKind, string>> = {
  CONFIRMED: 'Commande confirmée',
  UNAVAILABLE: 'Produit indisponible',
  PREPARING: 'En préparation',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  MANUAL: 'Message du vendeur',
};

/** Produit en quantité insuffisante, détaillé dans la réponse « Produit indisponible actuellement. ». */
export interface UnavailableItem {
  readonly productName: string;
  readonly requested: number;
  readonly available: number;
}

/** Résultat de l'envoi d'une réponse au client. */
export type CustomerReplyResult = 'DELIVERED' | 'OUTSIDE_WINDOW' | 'SEND_FAILED' | 'UNKNOWN_ORDER';

export const CUSTOMER_REPLY_RESULT_LABELS: Readonly<Record<CustomerReplyResult, string>> = {
  DELIVERED: 'Envoyée sur Messenger',
  OUTSIDE_WINDOW: 'Non envoyée : plus de 24 h depuis son dernier message, contactez-le directement',
  SEND_FAILED: 'Échec de l’envoi Messenger',
  UNKNOWN_ORDER: 'Commande inconnue du serveur',
};

/** Élément de l'historique des réponses Facebook. */
export interface CustomerReply {
  readonly id: string;
  readonly orderId: string;
  readonly kind: CustomerReplyKind;
  /** true : réponse automatique (vérification du stock) ; false : changement de statut par le vendeur. */
  readonly automatic: boolean;
  /** Texte exact envoyé au client (connu une fois l'envoi effectué). */
  readonly messageText: string | null;
  readonly createdAt: IsoDateString;
  /** null : en attente d'envoi (hors ligne). */
  readonly result: CustomerReplyResult | null;
}

/** Ligne de l'historique global des réponses. */
export interface CustomerReplyEntry {
  readonly reply: CustomerReply;
  readonly orderReference: string;
  readonly clientName: string | null;
}

/** État de la liaison avec le backend Messenger. */
export interface MessengerState {
  readonly connected: boolean;
  readonly backendUrl: string | null;
  readonly deviceName: string | null;
  readonly lastSyncAt: IsoDateString | null;
  readonly lastError: string | null;
  readonly syncing: boolean;
  /** Incrémenté à chaque synchronisation réussie (rafraîchit les écrans concernés). */
  readonly syncCount: number;
  /**
   * Réponse automatique après import : stock disponible → commande validée et « Votre commande est
   * confirmée. » ; stock insuffisant → « Produit indisponible actuellement. ».
   */
  readonly autoReply: boolean;
  /** Envoyer au client un message quand sa commande change de statut. */
  readonly notifyCustomer: boolean;
  /** Le serveur envoie une notification push à chaque nouvelle commande (APK uniquement). */
  readonly pushActive: boolean;
  /** Frais de livraison dans Antananarivo annoncés par le bot. */
  readonly deliveryFee: Money;
}

export interface SyncReport {
  readonly imported: number;
  readonly customerUpdatesSent: number;
}
