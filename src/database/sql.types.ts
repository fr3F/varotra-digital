/** Valeurs acceptées en paramètre d'une requête SQL. */
export type SqlValue = string | number | null;

/** Ligne brute renvoyée par SQLite : chaque colonne est validée par les lecteurs de sql-row.ts. */
export type SqlRow = Readonly<Record<string, unknown>>;

export interface SqlRunResult {
  readonly changes: number;
  readonly lastInsertRowId: number;
}

/** Contrat commun à la connexion principale et aux transactions. */
export interface SqlExecutor {
  run(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult>;
  select(sql: string, params?: readonly SqlValue[]): Promise<SqlRow[]>;
  selectOne(sql: string, params?: readonly SqlValue[]): Promise<SqlRow | null>;
}
