import { Client, ClientInput } from '@/models';
import { nowIso } from '@/utils/date.utils';
import { database } from '../database';
import { readNullableString, readString } from '../sql-row';
import { SqlExecutor, SqlRow } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

class ClientRepository extends BaseRepository<Client, ClientInput> {
  protected readonly tableName = 'clients';
  protected readonly entityLabel = 'Client';
  protected readonly defaultOrderBy = 'name COLLATE NOCASE ASC';

  /**
   * Client lié à ce PSID Messenger, y compris s'il a été supprimé : la colonne messenger_id
   * est unique, un client supprimé qui réécrit est donc restauré plutôt que recréé.
   */
  async findByMessengerId(
    messengerId: string,
    executor: SqlExecutor = database,
  ): Promise<{ client: Client; deleted: boolean } | null> {
    const row = await executor.selectOne('SELECT * FROM clients WHERE messenger_id = ?', [messengerId]);
    return row === null ? null : { client: this.fromRow(row), deleted: readNullableString(row, 'deleted_at') !== null };
  }

  async restore(id: string, executor: SqlExecutor = database): Promise<Client> {
    await executor.run(`UPDATE clients SET deleted_at = NULL, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [
      nowIso(),
      id,
    ]);
    return this.getById(id, executor);
  }

  protected fromRow(row: SqlRow): Client {
    return {
      ...this.readBaseFields(row),
      name: readString(row, 'name'),
      phone: readNullableString(row, 'phone'),
      address: readNullableString(row, 'address'),
      notes: readNullableString(row, 'notes'),
      messengerId: readNullableString(row, 'messenger_id'),
    };
  }

  protected toColumns(input: ClientInput): ColumnValues {
    return {
      name: input.name,
      phone: input.phone,
      address: input.address,
      notes: input.notes,
      messenger_id: input.messengerId,
    };
  }
}

export const clientRepository = new ClientRepository();
