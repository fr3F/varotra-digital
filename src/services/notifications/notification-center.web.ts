import { NotificationPermission as AppPermission, NotificationTarget } from '@/models';
import { NotificationCenter } from './notification-center.types';

const openHandlers = new Set<(target: NotificationTarget) => void>();

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Convertit la permission du navigateur (« default » = pas encore demandée). */
function toPermission(permission: NotificationPermission): AppPermission {
  switch (permission) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    default:
      return 'undetermined';
  }
}

/** Web : notifications du navigateur (API Notification), utiles pour tester sans téléphone. */
export const notificationCenter: NotificationCenter = {
  async setup() {
    // Rien à configurer : pas de canaux côté navigateur.
  },

  async getPermission() {
    return isSupported() ? toPermission(Notification.permission) : 'unsupported';
  },

  async requestPermission() {
    return isSupported() ? toPermission(await Notification.requestPermission()) : 'unsupported';
  },

  async show(notification) {
    if (!isSupported() || Notification.permission !== 'granted') {
      return;
    }
    const shown = new Notification(notification.title, { body: notification.body, tag: notification.type });
    shown.onclick = () => {
      window.focus();
      openHandlers.forEach((handler) => handler(notification.target));
      shown.close();
    };
  },

  onOpen(handler) {
    openHandlers.add(handler);
    return () => {
      openHandlers.delete(handler);
    };
  },

  onReceive() {
    // Pas de notification push sur le web : la synchronisation périodique suffit.
    return () => undefined;
  },

  async getPushToken() {
    return null;
  },
};
