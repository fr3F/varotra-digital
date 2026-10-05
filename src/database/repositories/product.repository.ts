import { InsufficientStockError } from '@/core/errors/app-error';
import { availableQuantity, EntityId, Product, ProductInput } from '@/models';
import { nowIso } from '@/utils/date.utils';
import { database } from '../database';
import { readNullableString, readNumber, readString } from '../sql-row';
import { SqlExecutor, SqlRow } from '../sql.types';
import { BaseRepository, ColumnValues } from './base.repository';

class ProductRepository extends BaseRepository<Product, ProductInput> {
  protected readonly tableName = 'products';
  protected readonly entityLabel = 'Produit';
  protected readonly defaultOrderBy = 'name COLLATE NOCASE ASC';

  /**
   * Applique une variation du stock physique de façon atomique.
   * La condition SQL interdit de descendre sous la quantité réservée par les commandes
   * (et donc sous zéro), même en cas d'appels concurrents.
   */
  async applyStockDelta(id: EntityId, delta: number, executor: SqlExecutor = database): Promise<Product> {
    const result = await executor.run(
      `UPDATE products
       SET stock_quantity = stock_quantity + ?, updated_at = ?, sync_status = 'PENDING'
       WHERE id = ? AND deleted_at IS NULL AND stock_quantity + ? >= reserved_quantity`,
      [delta, nowIso(), id, delta],
    );
    if (result.changes !== 1) {
      const product = await this.getById(id, executor);
      throw new InsufficientStockError(product.name, availableQuantity(product), Math.abs(delta));
    }
    return this.getById(id, executor);
  }

  /** Réserve des unités pour une commande, si elles sont disponibles. */
  async reserve(id: EntityId, quantity: number, executor: SqlExecutor = database): Promise<Product> {
    const result = await executor.run(
      `UPDATE products
       SET reserved_quantity = reserved_quantity + ?, updated_at = ?, sync_status = 'PENDING'
       WHERE id = ? AND deleted_at IS NULL AND stock_quantity - reserved_quantity >= ?`,
      [quantity, nowIso(), id, quantity],
    );
    if (result.changes !== 1) {
      const product = await this.getById(id, executor);
      throw new InsufficientStockError(product.name, availableQuantity(product), quantity);
    }
    return this.getById(id, executor);
  }

  /** Libère une réservation (annulation, livraison, retour en préparation). */
  async release(id: EntityId, quantity: number, executor: SqlExecutor = database): Promise<void> {
    await executor.run(
      `UPDATE products
       SET reserved_quantity = MAX(reserved_quantity - ?, 0), updated_at = ?, sync_status = 'PENDING'
       WHERE id = ?`,
      [quantity, nowIso(), id],
    );
  }

  protected fromRow(row: SqlRow): Product {
    return {
      ...this.readBaseFields(row),
      name: readString(row, 'name'),
      sku: readNullableString(row, 'sku'),
      description: readNullableString(row, 'description'),
      category: readNullableString(row, 'category'),
      imageUri: readNullableString(row, 'image_uri'),
      unitPrice: readNumber(row, 'unit_price'),
      costPrice: readNumber(row, 'cost_price'),
      stockQuantity: readNumber(row, 'stock_quantity'),
      reservedQuantity: readNumber(row, 'reserved_quantity'),
      alertThreshold: readNumber(row, 'alert_threshold'),
    };
  }

  protected toColumns(input: ProductInput): ColumnValues {
    return {
      name: input.name,
      sku: input.sku,
      description: input.description,
      category: input.category,
      image_uri: input.imageUri,
      unit_price: input.unitPrice,
      cost_price: input.costPrice,
      alert_threshold: input.alertThreshold,
    };
  }
}

export const productRepository = new ProductRepository();
