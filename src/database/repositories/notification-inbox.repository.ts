import { InboxNotification, LocalNotification, NOTIFICATION_TYPES, parseNotificationTarget } from '@/models';
import { nowIso } from '@/utils/date.utils';
import { generateId } from '@/utils/id.utils';
import { database } from '../database';
import { readEnum, readNullableString, readString } from '../sql-row';
import { SqlRow } from '../sql.types';

/** Au-delà, les plus anciennes notifications sont effacées. */
const MAX_KEPT = 200;

function parseTargetJson(json: string): ReturnType<typeof parseNotificationTarget> {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === 'object' && value !== null ? parseNotificationTarget(value as Readonly<Record<string, unknown>>) : null;
  } catch {
    return null;
  }
}

function toNotification(row: SqlRow): InboxNotification {
  return {
    id: readString(row, 'id'),
    type: readEnum(row, 'type', NOTIFICATION_TYPES),
    title: readString(row, 'title'),
    body: readString(row, 'body'),
    target: parseTargetJson(readString(row, 'target_json')),
    createdAt: readString(row, 'created_at'),
    readAt: readNullableString(row, 'read_at'),
  };
}

/** Historique des notifications (centre de notifications de l'application). */
export const notificationInboxRepository = {
  async add(notification: LocalNotification): Promise<void> {
    await database.run(
      `INSERT INTO app_notifications (id, type, title, body, target_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), notification.type, notification.title, notification.body, JSON.stringify(notification.target), nowIso()],
    );
    await database.run(
      `DELETE FROM app_notifications WHERE id NOT IN (SELECT id FROM app_notifications ORDER BY created_at DESC LIMIT ?)`,
      [MAX_KEPT],
    );
  },

  async findRecent(): Promise<InboxNotification[]> {
    const rows = await database.select('SELECT * FROM app_notifications ORDER BY created_at DESC LIMIT ?', [MAX_KEPT]);
    return rows.map(toNotification);
  },

  async markRead(id: string): Promise<void> {
    await database.run('UPDATE app_notifications SET read_at = ? WHERE id = ? AND read_at IS NULL', [nowIso(), id]);
  },

  async markAllRead(): Promise<void> {
    await database.run('UPDATE app_notifications SET read_at = ? WHERE read_at IS NULL', [nowIso()]);
  },

  async clear(): Promise<void> {
    await database.run('DELETE FROM app_notifications');
  },
};
