import { database } from '@/database/database';
import { customerService } from './customer.service';
import { imageStorage } from './image-storage/image-storage';
import { orderService } from './order.service';
import { productService } from './product.service';
import { stockService } from './stock.service';

/**
 * Tables vidées par la remise à zéro, des dépendantes vers les principales (clés étrangères).
 * Réglages et liaison Messenger (app_settings, jeton sécurisé) sont conservés.
 */
const TABLES_IN_DELETE_ORDER = [
  'messenger_replies',
  'order_status_history',
  'order_items',
  'sale_items',
  'stock_movements',
  'sales',
  'orders',
  'expenses',
  'clients',
  'products',
] as const;

/** Nombre d'éléments qui seront supprimés, pour la confirmation. */
export interface DataSummary {
  readonly products: number;
  readonly orders: number;
  readonly sales: number;
  readonly clients: number;
  readonly expenses: number;
}

async function countRows(table: (typeof TABLES_IN_DELETE_ORDER)[number]): Promise<number> {
  const row = await database.selectOne(`SELECT COUNT(*) AS total FROM ${table}`);
  const total = row?.['total'];
  return typeof total === 'number' ? total : 0;
}

/** Remise à zéro des données de l'application (paramètres › zone de danger). */
export const resetService = {
  async summary(): Promise<DataSummary> {
    const [products, orders, sales, clients, expenses] = await Promise.all([
      countRows('products'),
      countRows('orders'),
      countRows('sales'),
      countRows('clients'),
      countRows('expenses'),
    ]);
    return { products, orders, sales, clients, expenses };
  },

  /**
   * Supprime définitivement toutes les données métier (produits, stock, commandes, ventes,
   * dépenses, clients, réponses Messenger) et les photos des produits, en une seule transaction.
   */
  async deleteAllData(): Promise<void> {
    await database.transaction(async (tx) => {
      for (const table of TABLES_IN_DELETE_ORDER) {
        await tx.run(`DELETE FROM ${table}`);
      }
    });
    await imageStorage.removeAll().catch((error: unknown) => console.warn('[Carnet] Photos non supprimées', error));
    await Promise.all([productService.load(), orderService.load(), customerService.load(), stockService.refresh()]);
  },
};
