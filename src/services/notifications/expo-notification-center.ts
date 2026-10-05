import {
  addNotificationResponseReceivedListener,
  AndroidImportance,
  getLastNotificationResponseAsync,
  getPermissionsAsync,
  NotificationPermissionsStatus,
  PermissionStatus,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationPermission, NotificationType, parseNotificationTarget } from '@/models';
import { NotificationCenter } from './notification-center.types';

/** Un canal Android par type : le vendeur peut régler chacun dans les paramètres du téléphone. */
const CHANNELS: Readonly<Record<NotificationType, { id: string; name: string; importance: AndroidImportance }>> = {
  NEW_ORDER: { id: 'orders-new', name: 'Nouvelles commandes', importance: AndroidImportance.HIGH },
  LOW_STOCK: { id: 'stock-low', name: 'Stock faible', importance: AndroidImportance.DEFAULT },
  ORDER_COMPLETED: { id: 'orders-completed', name: 'Commandes terminées', importance: AndroidImportance.DEFAULT },
  SYNC_ERROR: { id: 'sync-errors', name: 'Erreurs de synchronisation', importance: AndroidImportance.HIGH },
};

let configured = false;

function toPermission(status: NotificationPermissionsStatus): NotificationPermission {
  if (status.granted) {
    return 'granted';
  }
  return status.status === PermissionStatus.DENIED ? 'denied' : 'undetermined';
}

/** Implémentation expo-notifications (chargée seulement hors Expo Go, voir notification-center.ts). */
export const expoNotificationCenter: NotificationCenter = {
  async setup() {
    if (configured) {
      return;
    }
    configured = true;
    // Affiche aussi les notifications quand l'application est au premier plan.
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Promise.all(
        Object.values(CHANNELS).map((channel) =>
          setNotificationChannelAsync(channel.id, { name: channel.name, importance: channel.importance }),
        ),
      );
    }
  },

  async getPermission() {
    return toPermission(await getPermissionsAsync());
  },

  async requestPermission() {
    return toPermission(await requestPermissionsAsync());
  },

  async show(notification) {
    await scheduleNotificationAsync({
      content: { title: notification.title, body: notification.body, data: { ...notification.target } },
      trigger: Platform.OS === 'android' ? { channelId: CHANNELS[notification.type].id } : null,
    });
  },

  onOpen(handler) {
    const subscription = addNotificationResponseReceivedListener((response) => {
      const target = parseNotificationTarget(response.notification.request.content.data);
      if (target !== null) {
        handler(target);
      }
    });
    // Application lancée en touchant une notification.
    void getLastNotificationResponseAsync().then((response) => {
      const target = response === null ? null : parseNotificationTarget(response.notification.request.content.data);
      if (target !== null) {
        handler(target);
      }
    });
    return () => subscription.remove();
  },
};
