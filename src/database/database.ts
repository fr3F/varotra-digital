import { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseError } from '@/core/errors/app-error';
import { runMigrations } from './migrations/migrate';
import { SqlExecutor, SqlRow, SqlRunResult, SqlValue } from './sql.types';

/**
 * Point d'accès unique à SQLite. La connexion est fournie par SQLiteProvider
 * (voir DatabaseProvider) au démarrage, puis utilisée par les repositories.
 */
class Database implements SqlExecutor {
  private connection: SQLiteDatabase | null = null;
  private transactionDepth = 0;
  private afterCommitTasks: (() => void)[] = [];

  attach(connection: SQLiteDatabase): void {
    this.connection = connection;
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<SqlRunResult> {
    const result = await this.requireConnection().runAsync(sql, [...params]);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
  }

  select(sql: string, params: readonly SqlValue[] = []): Promise<SqlRow[]> {
    return this.requireConnection().getAllAsync<SqlRow>(sql, [...params]);
  }

  selectOne(sql: string, params: readonly SqlValue[] = []): Promise<SqlRow | null> {
    return this.requireConnection().getFirstAsync<SqlRow>(sql, [...params]);
  }

  /**
   * Exécute `work` dans une transaction (rollback automatique en cas d'erreur).
   * Elle reste sur la connexion principale afin de conserver PRAGMA foreign_keys = ON.
   * Un appel imbriqué rejoint la transaction en cours : une vente peut ainsi déstocker
   * ses produits dans sa propre transaction, tout réussit ou tout est annulé.
   */
  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) {
      return work(this);
    }
    const box: { outcome?: { readonly value: T } } = {};
    try {
      await this.requireConnection().withTransactionAsync(async () => {
        this.transactionDepth += 1;
        try {
          box.outcome = { value: await work(this) };
        } finally {
          this.transactionDepth -= 1;
        }
      });
    } catch (error: unknown) {
      // Rollback : les effets prévus pour après la validation n'ont plus lieu d'être.
      this.afterCommitTasks = [];
      throw error;
    }
    if (box.outcome === undefined) {
      throw new DatabaseError("La transaction ne s'est pas terminée.");
    }
    const tasks = this.afterCommitTasks;
    this.afterCommitTasks = [];
    tasks.forEach((task) => task());
    return box.outcome.value;
  }

  /**
   * Planifie un effet de bord (notification…) pour après la validation de la transaction
   * en cours ; il est abandonné en cas d'annulation. Hors transaction, il s'exécute aussitôt.
   */
  afterCommit(task: () => void): void {
    if (this.transactionDepth === 0) {
      task();
      return;
    }
    this.afterCommitTasks.push(task);
  }

  private requireConnection(): SQLiteDatabase {
    if (this.connection === null) {
      throw new DatabaseError("La base de données n'est pas encore initialisée.");
    }
    return this.connection;
  }
}

export const database = new Database();

/** Appelée par SQLiteProvider.onInit, avant le rendu de l'application. */
export async function initializeDatabase(connection: SQLiteDatabase): Promise<void> {
  await connection.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await runMigrations(connection);
  database.attach(connection);
}
