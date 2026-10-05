import { ValidationError } from '@/core/errors/app-error';
import { database } from '@/database/database';
import { productRepository } from '@/database/repositories/product.repository';
import { availableQuantity, EntityId, Product, StockCheck, StockShortage, UnavailableItem } from '@/models';
import { notificationService } from './notifications/notification.service';
import { productService } from './product.service';
import { MovementResult, stockMovementService } from './stock-movement.service';

/** Ligne de vente (ou de commande) qui consomme du stock. */
export interface StockLine {
  readonly productId: EntityId;
  readonly quantity: number;
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new ValidationError('La quantité doit être un entier supérieur à zéro.');
  }
}

/** Regroupe les lignes d'un même produit pour un seul mouvement par produit. */
function mergeLines(lines: readonly StockLine[]): StockLine[] {
  const totals = new Map<EntityId, number>();
  lines.forEach((line) => {
    assertPositiveQuantity(line.quantity);
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  });
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

async function afterChange<T>(result: T): Promise<T> {
  await productService.load();
  return result;
}

/** Règles de gestion du stock. Toute écriture passe par stockMovementService. */
export const stockService = {
  /** Réapprovisionnement : augmente la quantité. */
  async addEntry(productId: EntityId, quantity: number, reason: string | null): Promise<MovementResult> {
    assertPositiveQuantity(quantity);
    return afterChange(
      await stockMovementService.record({
        productId,
        type: 'IN',
        quantityDelta: quantity,
        origin: 'MANUAL',
        reason,
        referenceId: null,
      }),
    );
  },

  /** Sortie hors vente (casse, perte, consommation…) : diminue la quantité. */
  async removeExit(productId: EntityId, quantity: number, reason: string | null): Promise<MovementResult> {
    assertPositiveQuantity(quantity);
    return afterChange(
      await stockMovementService.record({
        productId,
        type: 'OUT',
        quantityDelta: -quantity,
        origin: 'MANUAL',
        reason,
        referenceId: null,
      }),
    );
  },

  /** Inventaire : fixe la quantité réelle comptée. L'écart est tracé comme un ajustement. */
  async setQuantity(productId: EntityId, countedQuantity: number, reason: string | null): Promise<MovementResult> {
    if (!Number.isSafeInteger(countedQuantity) || countedQuantity < 0) {
      throw new ValidationError('La quantité comptée doit être un entier positif ou nul.');
    }
    const result = await database.transaction(async () => {
      const product = await productRepository.getById(productId);
      const delta = countedQuantity - product.stockQuantity;
      if (delta === 0) {
        throw new ValidationError(`Le stock de « ${product.name} » est déjà de ${countedQuantity}.`);
      }
      return stockMovementService.record({
        productId,
        type: 'ADJUSTMENT',
        quantityDelta: delta,
        origin: 'MANUAL',
        reason: reason ?? 'Inventaire',
        referenceId: null,
      });
    });
    return afterChange(result);
  },

  /**
   * Vente : diminue automatiquement le stock de chaque produit vendu.
   * À appeler depuis la transaction qui enregistre la vente : si un produit manque,
   * InsufficientStockError annule la vente entière. Appeler refresh() après la transaction.
   */
  async applySale(saleId: EntityId, lines: readonly StockLine[]): Promise<Product[]> {
    const merged = mergeLines(lines);
    return database.transaction(async () => {
      const products: Product[] = [];
      for (const line of merged) {
        const { product } = await stockMovementService.record({
          productId: line.productId,
          type: 'OUT',
          quantityDelta: -line.quantity,
          origin: 'SALE',
          reason: 'Vente',
          referenceId: saleId,
        });
        products.push(product);
      }
      return products;
    });
  },

  /** Annulation d'une vente : remet en stock les quantités sorties pour cette vente. */
  async revertSale(saleId: EntityId): Promise<Product[]> {
    return database.transaction(async () => {
      const movements = await stockMovementService.listByReference(saleId);
      const net = new Map<EntityId, number>();
      movements
        .filter((movement) => movement.origin === 'SALE')
        .forEach((movement) => net.set(movement.productId, (net.get(movement.productId) ?? 0) + movement.quantityDelta));

      const products: Product[] = [];
      for (const [productId, delta] of net) {
        if (delta >= 0) {
          continue;
        }
        const { product } = await stockMovementService.record({
          productId,
          type: 'IN',
          quantityDelta: -delta,
          origin: 'SALE',
          reason: 'Annulation de vente',
          referenceId: saleId,
        });
        products.push(product);
      }
      return products;
    });
  },

  /**
   * Vérification sans réservation : chaque produit est-il disponible en quantité suffisante ?
   * Un produit supprimé ou inconnu compte comme indisponible.
   */
  async checkAvailability(lines: readonly StockLine[]): Promise<StockCheck> {
    if (lines.length === 0) {
      return 'UNCHECKED';
    }
    for (const line of mergeLines(lines)) {
      const product = await productRepository.findById(line.productId);
      if (product === null || availableQuantity(product) < line.quantity) {
        return 'SHORTAGE';
      }
    }
    return 'OK';
  },

  /** Produits demandés en quantité supérieure au disponible (stock - déjà réservé). */
  async findOrderShortages(lines: readonly StockLine[]): Promise<StockShortage[]> {
    const shortages: StockShortage[] = [];
    for (const line of mergeLines(lines)) {
      const product = await productRepository.findById(line.productId);
      const available = product === null ? 0 : availableQuantity(product);
      if (available < line.quantity) {
        shortages.push({
          productId: line.productId,
          productName: product?.name ?? 'Produit retiré',
          requested: line.quantity,
          available,
        });
      }
    }
    return shortages;
  },

  /** Détail de la réponse « Produit indisponible actuellement. » envoyée au client. */
  async findShortages(lines: readonly StockLine[]): Promise<UnavailableItem[]> {
    const shortages = await stockService.findOrderShortages(lines);
    return shortages.map(({ productName, requested, available }) => ({ productName, requested, available }));
  },

  /**
   * Validation d'une commande : vérifie que chaque produit est disponible
   * (stock - déjà réservé) et réserve les quantités. Tout ou rien.
   */
  async reserveForOrder(lines: readonly StockLine[]): Promise<void> {
    const merged = mergeLines(lines);
    await database.transaction(async (tx) => {
      for (const line of merged) {
        const product = await productRepository.reserve(line.productId, line.quantity, tx);
        notificationService.checkLowStock(product, availableQuantity(product) + line.quantity);
      }
    });
  },

  /** Libère les quantités réservées par une commande (annulation, retour en préparation, suppression). */
  async releaseForOrder(lines: readonly StockLine[]): Promise<void> {
    const merged = mergeLines(lines);
    await database.transaction(async (tx) => {
      for (const line of merged) {
        await productRepository.release(line.productId, line.quantity, tx);
      }
    });
  },

  /** Livraison : la réservation devient une sortie de stock définitive, tracée dans l'historique. */
  async fulfillOrder(orderId: EntityId, reference: string, lines: readonly StockLine[]): Promise<void> {
    const merged = mergeLines(lines);
    await database.transaction(async (tx) => {
      for (const line of merged) {
        await productRepository.release(line.productId, line.quantity, tx);
        await stockMovementService.record({
          productId: line.productId,
          type: 'OUT',
          quantityDelta: -line.quantity,
          origin: 'ORDER',
          reason: `Livraison ${reference}`,
          referenceId: orderId,
          notifyLowStock: false,
        });
      }
    });
  },

  /** Recharge la liste des produits (quantités) après une opération faite hors de ce service. */
  refresh(): Promise<void> {
    return productService.load();
  },
};
