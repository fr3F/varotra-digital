import { ReactNode, useEffect } from 'react';
import { openNotificationTarget, syncIfConnected } from '@/core/navigation/open-target';
import { notificationService } from '@/services/notifications/notification.service';

/**
 * Initialise les notifications (préférences, canaux Android) une fois la base ouverte,
 * et ouvre l'écran concerné quand le vendeur touche une notification.
 */
export function NotificationBridge({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    notificationService.init().catch((error: unknown) => console.warn('[Carnet] Notifications indisponibles', error));
    const stopOpen = notificationService.onOpen(openNotificationTarget);
    // Push reçu application ouverte : la commande est importée tout de suite.
    const stopReceive = notificationService.onReceive((target) => {
      if (target.screen === 'messenger-order') {
        void syncIfConnected();
      }
    });
    return () => {
      stopOpen();
      stopReceive();
    };
  }, []);

  return <>{children}</>;
}
