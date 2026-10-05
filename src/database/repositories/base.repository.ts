import { DatabaseError, NotFoundError } from '@/core/errors/app-error';
import { BaseEntity, EntityId, SYNC_STATUSES } from '@/models';
import { nowIso } from '@/utils/date.utils';
import { generateId } from '@/utils/id.utils';
import { database } from '../database';
import { readEnum, readString } from '../sql-row';
import { SqlExecutor, SqlRow, SqlValue } from '../sql.types';

export type ColumnValues = Readonly<Record<string, SqlValue>>;

/**
 * CRUD générique sur une table respectant les conventions du schéma
 * (id UUID, created_at, updated_at, deleted_at, sync_status).
 * Chaque méthode accepte un `executor` pour pouvoir participer à une transaction.
 */
export abstract class BaseRepository<TEntity extends BaseEntity, TInput> {
  /** Nom de table : constante interne, jamais issue d'une saisie utilisateur. */
  protected abstract readonly tableName: string;
  protected abstract readonly entityLabel: string;
  protected abstract readonly defaultOrderBy: string;

  protected abstract fromRow(row: SqlRow): TEntity;
  protected abstract toColumns(input: TInput): ColumnValues;

  async findAll(executor: SqlExecutor = database): Promise<TEntity[]> {
    const rows = await executor.select(
      `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL ORDER BY ${this.defaultOrderBy}`,
    );
    return rows.map((row) => this.fromRow(row));
  }

  async findById(id: EntityId, executor: SqlExecutor = database): Promise<TEntity | null> {
    const row = await executor.selectOne(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row === null ? null : this.fromRow(row);
  }

  async getById(id: EntityId, executor: SqlExecutor = database): Promise<TEntity> {
    const entity = await this.findById(id, executor);
    if (entity === null) {
      throw new NotFoundError(this.entityLabel, id);
    }
    return entity;
  }

  async create(input: TInput, executor: SqlExecutor = database): Promise<TEntity> {
    const now = nowIso();
    const id = generateId();
    const columns: ColumnValues = {
      ...this.toColumns(input),
      id,
      created_at: now,
      updated_at: now,
      sync_status: 'PENDING',
    };
    const names = Object.keys(columns);
    const placeholders = names.map(() => '?').join(', ');

    await executor.run(
      `INSERT INTO ${this.tableName} (${names.join(', ')}) VALUES (${placeholders})`,
      Object.values(columns),
    );
    return this.getById(id, executor);
  }

  async update(id: EntityId, input: TInput, executor: SqlExecutor = database): Promise<TEntity> {
    const columns: ColumnValues = {
      ...this.toColumns(input),
      updated_at: nowIso(),
      sync_status: 'PENDING',
    };
    const assignments = Object.keys(columns).map((name) => `${name} = ?`);

    const result = await executor.run(
      `UPDATE ${this.tableName} SET ${assignments.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...Object.values(columns), id],
    );
    if (result.changes !== 1) {
      throw new NotFoundError(this.entityLabel, id);
    }
    return this.getById(id, executor);
  }

  /** Suppression logique : la ligne reste en base pour l'historique et la synchronisation. */
  async softDelete(id: EntityId, executor: SqlExecutor = database): Promise<void> {
    const now = nowIso();
    const result = await executor.run(
      `UPDATE ${this.tableName} SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING'
       WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
    if (result.changes !== 1) {
      throw new NotFoundError(this.entityLabel, id);
    }
  }

  async count(executor: SqlExecutor = database): Promise<number> {
    const row = await executor.selectOne(
      `SELECT COUNT(*) AS total FROM ${this.tableName} WHERE deleted_at IS NULL`,
    );
    const total = row?.['total'];
    if (typeof total !== 'number') {
      throw new DatabaseError(`Comptage impossible sur ${this.tableName}.`);
    }
    return total;
  }

  /** Convertit une ligne issue d'une jointure (SELECT t.*, …) en entité. */
  mapRow(row: SqlRow): TEntity {
    return this.fromRow(row);
  }

  protected readBaseFields(row: SqlRow): BaseEntity {
    return {
      id: readString(row, 'id'),
      createdAt: readString(row, 'created_at'),
      updatedAt: readString(row, 'updated_at'),
      syncStatus: readEnum(row, 'sync_status', SYNC_STATUSES),
    };
  }
}
