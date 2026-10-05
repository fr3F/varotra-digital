import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { SqlDb, SqlValue } from './sql.ts';

/** Mêmes fichiers de migration que Cloudflare D1 (wrangler d1 migrations). */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

function migrate(db: DatabaseSync): void {
  const versionRow = db.prepare('PRAGMA user_version').get();
  const current = typeof versionRow?.['user_version'] === 'number' ? versionRow['user_version'] : 0;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  files.slice(current).forEach((file, index) => {
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
      db.exec(`PRAGMA user_version = ${current + index + 1}`);
      db.exec('COMMIT');
    } catch (error: unknown) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

const bind = (params: readonly SqlValue[]): SQLInputValue[] => [...params];

/** Base SQLite locale (Node 24) : développement, tests, auto-hébergement. */
export function openNodeDatabase(path: string): SqlDb & { close(): void } {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);

  return {
    async all(sql, params = []) {
      return db.prepare(sql).all(...bind(params));
    },
    async first(sql, params = []) {
      return db.prepare(sql).get(...bind(params)) ?? null;
    },
    async run(sql, params = []) {
      return { changes: Number(db.prepare(sql).run(...bind(params)).changes) };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        statements.forEach((statement) => db.prepare(statement.sql).run(...bind(statement.params)));
        db.exec('COMMIT');
      } catch (error: unknown) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}
