import { createStore } from '@/core/state/store';
import { notificationInboxRepository } from '@/database/repositories/notification-inbox.repository';
import { InboxNotification, LocalNotification } from '@/models';

export interface InboxState {
  readonly items: readonly InboxNotification[];
  readonly unread: number;
}

/** Centre de notifications : liste et nombre de non lues (pastille de la cloche). */
export const inboxStore = createStore<InboxState>({ items: [], unread: 0 });

async function refresh(): Promise<void> {
  const items = await notificationInboxRepository.findRecent();
  inboxStore.set({ items, unread: items.filter((item) => item.readAt === null).length });
}

export const inboxService = {
  load: refresh,

  /** Garde l'événement dans le centre de notifications (même si la notification système est désactivée). */
  async record(notification: LocalNotification): Promise<void> {
    await notificationInboxRepository.add(notification);
    await refresh();
  },

  async markRead(id: string): Promise<void> {
    await notificationInboxRepository.markRead(id);
    await refresh();
  },

  async markAllRead(): Promise<void> {
    await notificationInboxRepository.markAllRead();
    await refresh();
  },

  async clear(): Promise<void> {
    await notificationInboxRepository.clear();
    await refresh();
  },
};
