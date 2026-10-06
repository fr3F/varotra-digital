import { router } from 'expo-router';
import { NotificationTarget } from '@/models';
import { findImportedOrderId } from '@/services/messenger/messenger-import';
import { messengerStore } from '@/services/messenger/messenger-state';
import { messengerSyncService } from '@/services/messenger/messenger-sync.service';

export function syncIfConnected(): Promise<unknown> {
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

/** Ouvre l'écran d'une notification (système ou centre de notifications). */
export function openNotificationTarget(target: NotificationTarget): void {
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
