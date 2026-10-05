import { createStore } from '@/core/state/store';
import { database } from '@/database/database';
import { clientRepository } from '@/database/repositories/client.repository';
import { orderRepository } from '@/database/repositories/order.repository';
import { productRepository } from '@/database/repositories/product.repository';
import { saleItemRepository } from '@/database/repositories/sale-item.repository';
import { saleRepository } from '@/database/repositories/sale.repository';
import {
  EntityId,
  Order,
  OrderItem,
  Period,
  periodStart,
  Sale,
  SaleDetail,
  SaleDraft,
  SaleSummary,
  SalesTotals,
} from '@/models';
import { computeLineTotal, computeLinesTotal, ProductLine, referencePrefix, validateProductLines } from './product-lines';
import { productService } from './product.service';
import { stockService } from './stock.service';

/** Incrémenté après chaque vente : les écrans (historique, tableau de bord) s'y abonnent. */
export const salesVersion = createStore(0);

async function nextReference(date: Date): Promise<string> {
  const prefix = referencePrefix('VTE', date);
  const count = await saleRepository.countReferences(prefix);
  return `${prefix}${String(count + 1).padStart(3, '0')}`;
}

/**
 * Enregistre la vente et ses lignes avec le prix d'achat du moment (bénéfice figé).
 * Doit être appelée dans une transaction.
 */
async function insertSale(
  header: Pick<Sale, 'orderId' | 'clientId' | 'paymentMethod' | 'notes'>,
  lines: readonly ProductLine[],
): Promise<Sale> {
  const costs = new Map<EntityId, number>();
  for (const line of lines) {
    const product = await productRepository.getById(line.productId);
    costs.set(line.productId, product.costPrice);
  }
  const totalCost = lines.reduce((total, line) => total + (costs.get(line.productId) ?? 0) * line.quantity, 0);
  const now = new Date();
  const sale = await saleRepository.create({
    ...header,
    reference: await nextReference(now),
    totalAmount: computeLinesTotal(lines),
    totalCost,
    soldAt: now.toISOString(),
  });
  for (const line of lines) {
    await saleItemRepository.create({
      saleId: sale.id,
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unitCost: costs.get(line.productId) ?? 0,
      lineTotal: computeLineTotal(line.quantity, line.unitPrice),
    });
  }
  database.afterCommit(() => salesVersion.set((version) => version + 1));
  return sale;
}

/** Ventes : encaissement, bénéfice et mise à jour du stock. */
export const saleService = {
  list(period: Period): Promise<SaleSummary[]> {
    return saleRepository.findSummaries(periodStart(period));
  },

  totals(period: Period): Promise<SalesTotals> {
    return saleRepository.totals(periodStart(period));
  },

  async getDetail(id: EntityId): Promise<SaleDetail> {
    const sale = await saleRepository.getById(id);
    const [client, order, lines] = await Promise.all([
      sale.clientId === null ? Promise.resolve(null) : clientRepository.findById(sale.clientId),
      sale.orderId === null ? Promise.resolve(null) : orderRepository.findById(sale.orderId),
      saleItemRepository.findDetailsBySale(id),
    ]);
    return { sale, client, orderReference: order?.reference ?? null, lines };
  },

  /**
   * Vente directe (au comptoir) : vérifie le stock disponible, enregistre la vente
   * et fait sortir les quantités avec un mouvement « Vente » par produit. Tout ou rien.
   */
  async create(draft: SaleDraft): Promise<Sale> {
    const lines = validateProductLines(draft.lines);
    const sale = await database.transaction(async () => {
      if (draft.clientId !== null) {
        await clientRepository.getById(draft.clientId);
      }
      const created = await insertSale(
        { orderId: null, clientId: draft.clientId, paymentMethod: draft.paymentMethod, notes: draft.notes },
        lines,
      );
      await stockService.applySale(created.id, lines);
      return created;
    });
    await productService.load();
    return sale;
  },

  /**
   * Commande livrée → vente (chiffre d'affaires et bénéfice). Le stock est déjà sorti
   * par la livraison : aucun mouvement ici. Idempotent. À appeler dans la transaction de livraison.
   */
  async recordFromOrder(order: Order, items: readonly OrderItem[]): Promise<Sale> {
    return database.transaction(async () => {
      const existing = await saleRepository.findByOrder(order.id);
      if (existing !== null) {
        return existing;
      }
      return insertSale(
        { orderId: order.id, clientId: order.clientId, paymentMethod: 'CASH', notes: `Commande ${order.reference}` },
        items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })),
      );
    });
  },
};
