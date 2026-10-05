import { database } from '@/database/database';
import { orderItemRepository } from '@/database/repositories/order-item.repository';
import { productRepository } from '@/database/repositories/product.repository';
import { EntityId, Money, OrderItem, OrderLineDetail, OrderLineDraft } from '@/models';
import { computeLineTotal, computeLinesTotal, validateProductLines } from './product-lines';
import { StockLine } from './stock.service';

export function computeOrderTotal(lines: readonly OrderLineDraft[]): Money {
  return computeLinesTotal(lines);
}

/** Lignes d'une commande : validation, calcul des montants et enregistrement. */
export const orderItemService = {
  /** `allowEmpty` : commande Messenger « à vérifier » reçue sans produit reconnu. */
  validateLines(lines: readonly OrderLineDraft[], allowEmpty = false): readonly OrderLineDraft[] {
    return validateProductLines(lines, { allowEmpty });
  },

  /**
   * Remplace toutes les lignes de la commande (les anciennes sont supprimées logiquement).
   * Rejoint la transaction en cours de OrderService.
   */
  async replaceForOrder(orderId: EntityId, lines: readonly OrderLineDraft[], allowEmpty = false): Promise<OrderItem[]> {
    const valid = orderItemService.validateLines(lines, allowEmpty);
    return database.transaction(async (tx) => {
      await orderItemRepository.softDeleteByOrder(orderId, tx);
      const items: OrderItem[] = [];
      for (const line of valid) {
        // Refuse un produit supprimé entre-temps.
        await productRepository.getById(line.productId, tx);
        items.push(
          await orderItemRepository.create(
            {
              orderId,
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: computeLineTotal(line.quantity, line.unitPrice),
            },
            tx,
          ),
        );
      }
      return items;
    });
  },

  listByOrder(orderId: EntityId): Promise<OrderItem[]> {
    return orderItemRepository.findByOrder(orderId);
  },

  listDetails(orderId: EntityId): Promise<OrderLineDetail[]> {
    return orderItemRepository.findDetailsByOrder(orderId);
  },

  removeForOrder(orderId: EntityId): Promise<void> {
    return orderItemRepository.softDeleteByOrder(orderId);
  },

  toStockLines(items: readonly OrderItem[]): StockLine[] {
    return items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
  },
};
