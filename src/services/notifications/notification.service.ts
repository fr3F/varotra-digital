import { createStore } from '@/core/state/store';
import { database } from '@/database/database';
import { settingsRepository } from '@/database/repositories/settings.repository';
import {
  availableQuantity,
  DEFAULT_NOTIFICATION_PREFERENCES,
  LocalNotification,
  NOTIFICATION_TYPES,
  NotificationPermission,
  NotificationPreferences,
  NotificationType,
  Order,
  Product,
} from '@/models';
import { formatMoney } from '@/utils/money.utils';
import { notificationCenter } from './notification-center';

const PREFERENCE_PREFIX = 'notifications.';

/** Préférences par type de notification, enregistrées dans SQLite. */
export const notificationPreferencesStore = createStore<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

/** Évite de redemander la permission à chaque notification si le vendeur l'a refusée. */
let permissionAsked = false;

async function deliver(notification: LocalNotification): Promise<boolean> {
  if (!notificationPreferencesStore.get()[notification.type]) {
    return false;
  }
  let permission = await notificationCenter.getPermission();
  if (permission === 'undetermined' && !permissionAsked) {
    permissionAsked = true;
    permission = await notificationCenter.requestPermission();
  }
  if (permission !== 'granted') {
    return false;
  }
  await notificationCenter.show(notification);
  return true;
}

/**
 * Programme l'envoi après la validation de la transaction en cours :
 * une opération annulée ne notifie jamais.
 */
function queue(notification: LocalNotification): void {
  database.afterCommit(() => {
    deliver(notification).catch((error: unknown) => console.warn('[Carnet] Notification non envoyée', error));
  });
}

function orderTitle(order: Order, clientName: string | null): string {
  return clientName === null ? order.reference : `${order.reference} · ${clientName}`;
}

/** Notifications locales destinées au vendeur. */
export const notificationService = {
  /** À appeler au démarrage, une fois la base ouverte. */
  async init(): Promise<void> {
    const stored = await settingsRepository.getAll(PREFERENCE_PREFIX);
    const preferences = NOTIFICATION_TYPES.reduce<Record<NotificationType, boolean>>(
      (result, type) => {
        const value = stored.get(`${PREFERENCE_PREFIX}${type}`);
        return { ...result, [type]: value === undefined ? DEFAULT_NOTIFICATION_PREFERENCES[type] : value === '1' };
      },
      { ...DEFAULT_NOTIFICATION_PREFERENCES },
    );
    notificationPreferencesStore.set(preferences);
    await notificationCenter.setup();
  },

  async setEnabled(type: NotificationType, enabled: boolean): Promise<void> {
    await settingsRepository.set(`${PREFERENCE_PREFIX}${type}`, enabled ? '1' : '0');
    notificationPreferencesStore.set((current) => ({ ...current, [type]: enabled }));
  },

  getPermission(): Promise<NotificationPermission> {
    return notificationCenter.getPermission();
  },

  requestPermission(): Promise<NotificationPermission> {
    permissionAsked = true;
    return notificationCenter.requestPermission();
  },

  onOpen: notificationCenter.onOpen,

  notifyNewOrder(order: Order, clientName: string | null): void {
    const fromMessenger = order.source === 'MESSENGER';
    const check = !fromMessenger
      ? ''
      : order.needsReview
        ? ' · à vérifier'
        : order.stockCheck === 'SHORTAGE'
          ? ' · ⚠️ stock insuffisant'
          : order.stockCheck === 'OK'
            ? ' · stock OK'
            : '';
    queue({
      type: 'NEW_ORDER',
      title: fromMessenger ? 'Nouvelle commande Messenger' : 'Nouvelle commande',
      body: `${orderTitle(order, clientName)} — ${formatMoney(order.totalAmount)}${check}`,
      target: { screen: 'order', id: order.id },
    });
  },

  notifyOrderCompleted(order: Order, clientName: string | null): void {
    queue({
      type: 'ORDER_COMPLETED',
      title: 'Commande livrée',
      body: `${orderTitle(order, clientName)} — ${formatMoney(order.totalAmount)} encaissés`,
      target: { screen: 'order', id: order.id },
    });
  },

  /**
   * Prévient seulement au franchissement du seuil (ou au passage en rupture),
   * pas à chaque mouvement d'un produit déjà en stock bas.
   */
  checkLowStock(product: Product, previousAvailable: number): void {
    const available = availableQuantity(product);
    const crossedThreshold = previousAvailable > product.alertThreshold && available <= product.alertThreshold;
    const becameOut = previousAvailable > 0 && available === 0;
    if (!crossedThreshold && !becameOut) {
      return;
    }
    queue({
      type: 'LOW_STOCK',
      title: available === 0 ? 'Rupture de stock' : 'Stock faible',
      body:
        available === 0
          ? `${product.name} n’est plus disponible.`
          : `${product.name} : ${available} disponible(s), seuil d’alerte ${product.alertThreshold}.`,
      target: { screen: 'stock', id: product.id },
    });
  },

  /** À appeler par le futur module de synchronisation (Messenger) en cas d'échec. */
  notifySyncError(details: string): void {
    queue({
      type: 'SYNC_ERROR',
      title: 'Échec de la synchronisation',
      body: details,
      target: { screen: 'dashboard' },
    });
  },

  /** Notification d'essai (écran Réglages) : ignore la préférence pour vérifier l'affichage. */
  async sendTest(type: NotificationType): Promise<boolean> {
    let permission = await notificationCenter.getPermission();
    if (permission !== 'granted') {
      permission = await notificationService.requestPermission();
    }
    if (permission !== 'granted') {
      return false;
    }
    await notificationCenter.show({
      type,
      title: 'Test : notification',
      body: 'Les notifications de Carnet Digital fonctionnent sur cet appareil.',
      target: { screen: 'dashboard' },
    });
    return true;
  },
};
