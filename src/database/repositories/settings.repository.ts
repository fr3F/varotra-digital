import { nowIso } from '@/utils/date.utils';
import { database } from '../database';
import { readString } from '../sql-row';

/** Réglages de l'application (clé/valeur texte). */
export const settingsRepository = {
  async getAll(prefix: string): Promise<ReadonlyMap<string, string>> {
    const rows = await database.select('SELECT key, value FROM app_settings WHERE key LIKE ?', [`${prefix}%`]);
    return new Map(rows.map((row) => [readString(row, 'key'), readString(row, 'value')]));
  },

  async set(key: string, value: string): Promise<void> {
    await database.run(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, nowIso()],
    );
  },
};
