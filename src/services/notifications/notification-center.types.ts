import { LocalNotification, NotificationPermission, NotificationTarget } from '@/models';

/**
 * Accès aux notifications du système. Deux implémentations :
 * - notification-center.ts : Android (expo-notifications, un canal par type ; désactivé dans Expo Go) ;
 * - notification-center.web.ts : navigateur (API Notification).
 */
export interface NotificationCenter {
  setup(): Promise<void>;
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  show(notification: LocalNotification): Promise<void>;
  /** Appelé quand le vendeur touche une notification (y compris au lancement de l'app). */
  onOpen(handler: (target: NotificationTarget) => void): () => void;
  /** Appelé quand une notification push arrive pendant que l'application est ouverte. */
  onReceive(handler: (target: NotificationTarget) => void): () => void;
  /**
   * Jeton Expo Push de ce téléphone (demande la permission si besoin), ou null : web, Expo Go,
   * permission refusée. `projectId` : identifiant du projet EAS.
   */
  getPushToken(projectId: string): Promise<string | null>;
}
