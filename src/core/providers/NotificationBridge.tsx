import { ReactNode, useEffect } from 'react';
import { router } from 'expo-router';
import { NotificationTarget } from '@/models';
import { findImportedOrderId } from '@/services/messenger/messenger-import';
import { messengerStore } from '@/services/messenger/messenger-state';
import { messengerSyncService } from '@/services/messenger/messenger-sync.service';
import { notificationService } from '@/services/notifications/notification.service';

function syncIfConnected(): Promise<unknown> {
  return messengerStore.get().connected ? messengerSyncService.sync().catch(() => undefined) : Promise.resolve();
}

/** Push « Nouvelle commande » : importe la commande puis l'ouvre (la liste si elle n'est pas encore là). */
async function openMessengerOrder(remoteId: string): Promise<void> {
  await syncIfConnected();
  const orderId = await findImportedOrderId(remoteId).catch(() => null);
  if (orderId === null) {
    router.navigate('/orders');
  } else {
    router.push({ pathname: '/orders/[id]', params: { id: orderId } });
  }
}

function openTarget(target: NotificationTarget): void {
  switch (target.screen) {
    case 'messenger-order':
      void openMessengerOrder(target.id);
      return;
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
    const stopOpen = notificationService.onOpen(openTarget);
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
