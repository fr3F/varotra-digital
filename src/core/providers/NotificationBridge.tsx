import { ReactNode, useEffect } from 'react';
import { router } from 'expo-router';
import { NotificationTarget } from '@/models';
import { notificationService } from '@/services/notifications/notification.service';

function openTarget(target: NotificationTarget): void {
  switch (target.screen) {
    case 'order':
      router.push({ pathname: '/orders/[id]', params: { id: target.id } });
      return;
    case 'stock':
      router.push({ pathname: '/stock/[productId]', params: { productId: target.id } });
      return;
    case 'dashboard':
      router.navigate('/');
      return;
  }
}

/**
 * Initialise les notifications (préférences, canaux Android) une fois la base ouverte,
 * et ouvre l'écran concerné quand le vendeur touche une notification.
 */
export function NotificationBridge({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    notificationService.init().catch((error: unknown) => console.warn('[Carnet] Notifications indisponibles', error));
    return notificationService.onOpen(openTarget);
  }, []);

  return <>{children}</>;
}
