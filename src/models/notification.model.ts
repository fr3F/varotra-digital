export const NOTIFICATION_TYPES = ['NEW_ORDER', 'LOW_STOCK', 'ORDER_COMPLETED', 'SYNC_ERROR'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Readonly<Record<NotificationType, string>> = {
  NEW_ORDER: 'Nouvelle commande',
  LOW_STOCK: 'Stock faible',
  ORDER_COMPLETED: 'Commande terminée',
  SYNC_ERROR: 'Erreur de synchronisation',
};

export const NOTIFICATION_TYPE_DESCRIPTIONS: Readonly<Record<NotificationType, string>> = {
  NEW_ORDER: 'À chaque commande enregistrée (et bientôt reçue via Messenger).',
  LOW_STOCK: 'Quand un produit passe sous son seuil d’alerte ou tombe en rupture.',
  ORDER_COMPLETED: 'Quand une commande est livrée et encaissée.',
  SYNC_ERROR: 'Quand la synchronisation (Messenger) échoue.',
};

export type NotificationPreferences = Readonly<Record<NotificationType, boolean>>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  NEW_ORDER: true,
  LOW_STOCK: true,
  ORDER_COMPLETED: true,
  SYNC_ERROR: true,
};

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Écran ouvert quand le vendeur touche la notification. */
export type NotificationTarget =
  | { readonly screen: 'order'; readonly id: string }
  | { readonly screen: 'stock'; readonly id: string }
  /** Commande Messenger annoncée par push avant son import : `id` = identifiant côté serveur. */
  | { readonly screen: 'messenger-order'; readonly id: string }
  | { readonly screen: 'dashboard' };

/** Notification gardée dans le centre de notifications (cloche de l'en-tête). */
export interface InboxNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  /** Écran à ouvrir, ou null si la cible n'est plus lisible. */
  readonly target: NotificationTarget | null;
  readonly createdAt: string;
  readonly readAt: string | null;
}

/** Contenu d'une notification locale. */
export interface LocalNotification {
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly target: NotificationTarget;
}

/** Relit une cible transportée dans les données d'une notification (valeurs inconnues ignorées). */
export function parseNotificationTarget(data: Readonly<Record<string, unknown>> | undefined): NotificationTarget | null {
  const screen = data?.['screen'];
  const id = data?.['id'];
  if (screen === 'dashboard') {
    return { screen };
  }
  if ((screen === 'order' || screen === 'stock' || screen === 'messenger-order') && typeof id === 'string' && id.length > 0) {
    return { screen, id };
  }
  return null;
}
