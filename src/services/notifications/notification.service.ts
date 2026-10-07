import { messagesOf } from '@/core/i18n/i18n';
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
import { inboxService } from './inbox.service';
import { notificationCenter } from './notification-center';
import { notificationsMessages } from './notifications.messages';

const PREFERENCE_PREFIX = 'notifications.';

/** Préférences par type de notification, enregistrées dans SQLite. */
export const notificationPreferencesStore = createStore<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

/** Évite de redemander la permission à chaque notification si le vendeur l'a refusée. */
let permissionAsked = false;
/** Le serveur prévient déjà par push des commandes Messenger : pas de seconde notification à l'import. */
let remotePushActive = false;

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
 * Programme l'envoi après la validation de la transaction en cours : une opération annulée
 * ne notifie jamais. L'événement est toujours gardé dans le centre de notifications ;
 * `systemNotification: false` : pas de notification système (déjà prévenu par push).
 */
function queue(notification: LocalNotification, options: { readonly systemNotification?: boolean } = {}): void {
  database.afterCommit(() => {
    inboxService.record(notification).catch((error: unknown) => console.warn('[Carnet] Notification non gardée', error));
    if (options.systemNotification !== false) {
      deliver(notification).catch((error: unknown) => console.warn('[Carnet] Notification non envoyée', error));
    }
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
    await inboxService.load();
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

  onReceive: notificationCenter.onReceive,

  setRemotePushActive(active: boolean): void {
    remotePushActive = active;
  },

  notifyNewOrder(order: Order, clientName: string | null): void {
    const fromMessenger = order.source === 'MESSENGER';
    const t = messagesOf(notificationsMessages);
    const check = !fromMessenger
      ? ''
      : order.needsReview
        ? t.reviewSuffix
        : order.stockCheck === 'SHORTAGE'
          ? t.shortageSuffix
          : order.stockCheck === 'OK'
            ? t.stockOkSuffix
            : '';
    queue({
      type: 'NEW_ORDER',
      title: fromMessenger ? t.newMessengerOrder : t.newOrder,
      body: `${orderTitle(order, clientName)} — ${formatMoney(order.totalAmount)}${check}`,
      target: { screen: 'order', id: order.id },
    }, { systemNotification: !(fromMessenger && remotePushActive) });
  },

  notifyOrderCompleted(order: Order, clientName: string | null): void {
    const t = messagesOf(notificationsMessages);
    queue({
      type: 'ORDER_COMPLETED',
      title: t.orderDelivered,
      body: `${orderTitle(order, clientName)} — ${t.collected(formatMoney(order.totalAmount))}`,
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
    const t = messagesOf(notificationsMessages);
    queue({
      type: 'LOW_STOCK',
      title: available === 0 ? t.outOfStock : t.lowStock,
      body:
        available === 0
          ? t.noLongerAvailable(product.name)
          : t.lowStockBody(product.name, available, product.alertThreshold),
      target: { screen: 'stock', id: product.id },
    });
  },

  /** À appeler par le futur module de synchronisation (Messenger) en cas d'échec. */
  notifySyncError(details: string): void {
    queue({
      type: 'SYNC_ERROR',
      title: messagesOf(notificationsMessages).syncFailed,
      body: details,
      target: { screen: 'dashboard' },
    });
  },

  /** Notification d'essai (écran Réglages) : ignore la préférence pour vérifier l'affichage. */
  async sendTest(type: NotificationType): Promise<boolean> {
    const t = messagesOf(notificationsMessages);
    // Visible aussi dans le centre de notifications (cloche), même sans autorisation système.
    await inboxService.record({ type, title: t.testTitle, body: t.testBody, target: { screen: 'dashboard' } });
    let permission = await notificationCenter.getPermission();
    if (permission !== 'granted') {
      permission = await notificationService.requestPermission();
    }
    if (permission !== 'granted') {
      return false;
    }
    await notificationCenter.show({
      type,
      title: messagesOf(notificationsMessages).testTitle,
      body: messagesOf(notificationsMessages).testBody,
      target: { screen: 'dashboard' },
    });
    return true;
  },
};
