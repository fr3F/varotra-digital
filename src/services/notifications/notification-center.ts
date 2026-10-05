import { isRunningInExpoGo } from 'expo';
import { NotificationCenter } from './notification-center.types';

/**
 * Expo Go (SDK 53+) refuse le chargement d'expo-notifications sur Android : le module n'est
 * importé que dans un vrai build (APK / development build). Dans Expo Go, les notifications
 * sont simplement désactivées et le reste de l'application fonctionne normalement.
 */
const implementation: Promise<NotificationCenter | null> = isRunningInExpoGo()
  ? Promise.resolve(null)
  : import('./expo-notification-center').then((module) => module.expoNotificationCenter);

export const notificationCenter: NotificationCenter = {
  async setup() {
    await (await implementation)?.setup();
  },

  async getPermission() {
    return (await (await implementation)?.getPermission()) ?? 'denied';
  },

  async requestPermission() {
    return (await (await implementation)?.requestPermission()) ?? 'denied';
  },

  async show(notification) {
    await (await implementation)?.show(notification);
  },

  onOpen(handler) {
    let unsubscribe: (() => void) | null = null;
    let disposed = false;
    void implementation.then((center) => {
      if (center !== null && !disposed) {
        unsubscribe = center.onOpen(handler);
      }
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  },
};
