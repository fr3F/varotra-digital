import type { Row, SqlDb } from './sql.ts';

/** Sous-ensemble de l'API Cloudflare D1 utilisé ici (évite d'imposer les types globaux Workers). */
export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all(): Promise<{ readonly results: readonly unknown[] }>;
  first(): Promise<unknown>;
  run(): Promise<{ readonly meta: { readonly changes?: number } }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
  batch(statements: readonly D1PreparedStatementLike[]): Promise<unknown>;
}

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Base Cloudflare D1 (SQLite géré). Le schéma est créé par
 * `wrangler d1 migrations apply`, avec les mêmes fichiers que la version Node.
 */
export function d1Database(d1: D1DatabaseLike): SqlDb {
  return {
    async all(sql, params = []) {
      const { results } = await d1.prepare(sql).bind(...params).all();
      return results.filter(isRow);
    },
    async first(sql, params = []) {
      const row = await d1.prepare(sql).bind(...params).first();
      return isRow(row) ? row : null;
    },
    async run(sql, params = []) {
      const result = await d1.prepare(sql).bind(...params).run();
      return { changes: result.meta.changes ?? 0 };
    },
    async batch(statements) {
      // D1 exécute un batch comme une transaction : tout ou rien.
      await d1.batch(statements.map((statement) => d1.prepare(statement.sql).bind(...statement.params)));
    },
  };
}
