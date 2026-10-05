/** Valeur liée à un paramètre SQL. */
export type SqlValue = string | number | null;

/** Ligne renvoyée par la base : chaque colonne est validée par les lecteurs ci-dessous. */
export type Row = Readonly<Record<string, unknown>>;

export interface SqlStatement {
  readonly sql: string;
  readonly params: readonly SqlValue[];
}

/**
 * Accès SQL asynchrone, commun aux deux environnements :
 * SQLite de Node (développement, tests) et Cloudflare D1 (production).
 */
export interface SqlDb {
  all(sql: string, params?: readonly SqlValue[]): Promise<Row[]>;
  first(sql: string, params?: readonly SqlValue[]): Promise<Row | null>;
  run(sql: string, params?: readonly SqlValue[]): Promise<{ readonly changes: number }>;
  /** Exécute plusieurs écritures de façon atomique (tout ou rien). */
  batch(statements: readonly SqlStatement[]): Promise<void>;
}

function invalid(column: string, expected: string): Error {
  return new Error(`Colonne « ${column} » invalide : ${expected} attendu.`);
}

export function readString(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw invalid(column, 'texte');
  }
  return value;
}

export function readNullableString(row: Row, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalid(column, 'texte ou NULL');
  }
  return value;
}

export function readNumber(row: Row, column: string): number {
  const value = row[column];
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value !== 'number') {
    throw invalid(column, 'nombre');
  }
  return value;
}
