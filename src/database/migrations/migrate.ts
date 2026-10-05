import { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseError } from '@/core/errors/app-error';
import { SqlRow } from '../sql.types';
import { MIGRATIONS } from './index';

async function readSchemaVersion(connection: SQLiteDatabase): Promise<number> {
  const row = await connection.getFirstAsync<SqlRow>('PRAGMA user_version');
  const version = row?.['user_version'];
  return typeof version === 'number' ? version : 0;
}

/** Applique dans l'ordre, chacune dans sa transaction, les migrations pas encore jouées. */
export async function runMigrations(connection: SQLiteDatabase): Promise<void> {
  const currentVersion = await readSchemaVersion(connection);
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    if (!Number.isInteger(migration.version)) {
      throw new DatabaseError(`Version de migration invalide : ${migration.name}`);
    }
    try {
      await connection.withTransactionAsync(async () => {
        await connection.execAsync(migration.sql);
        await connection.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error: unknown) {
      throw new DatabaseError(`Échec de la migration ${migration.version} (${migration.name}).`, error);
    }
  }
}
