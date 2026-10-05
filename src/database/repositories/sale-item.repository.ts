import { EntityId, SaleItem, SaleItemInput, SaleLineDetail } from '@/models';
import { database } from '../database';
import { readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

class SaleItemRepository extends BaseRepository<SaleItem, SaleItemInput> {
  protected readonly tableName = 'sale_items';
  protected readonly entityLabel = 'Ligne de vente';
  protected readonly defaultOrderBy = 'created_at ASC, rowid ASC';

  /** Lignes avec nom et image du produit (produits supprimés compris, pour l'historique). */
  async findDetailsBySale(saleId: EntityId, executor: SqlExecutor = database): Promise<SaleLineDetail[]> {
    const rows = await executor.select(
      `SELECT i.*, p.name AS product_name, p.image_uri AS product_image_uri
       FROM sale_items AS i
       JOIN products AS p ON p.id = i.product_id
       WHERE i.sale_id = ? AND i.deleted_at IS NULL
       ORDER BY i.created_at ASC, i.rowid ASC`,
      [saleId],
    );
    return rows.map((row) => ({
      item: this.fromRow(row),
      productName: readString(row, 'product_name'),
      productImageUri: readNullableString(row, 'product_image_uri'),
    }));
  }

  protected fromRow(row: SqlRow): SaleItem {
    return {
      ...this.readBaseFields(row),
      saleId: readString(row, 'sale_id'),
      productId: readString(row, 'product_id'),
      quantity: readNumber(row, 'quantity'),
      unitPrice: readNumber(row, 'unit_price'),
      unitCost: readNumber(row, 'unit_cost'),
      lineTotal: readNumber(row, 'line_total'),
    };
  }

  protected toColumns(input: SaleItemInput): ColumnValues {
    return {
      sale_id: input.saleId,
      product_id: input.productId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      unit_cost: input.unitCost,
      line_total: input.lineTotal,
    };
  }
}

export const saleItemRepository = new SaleItemRepository();
