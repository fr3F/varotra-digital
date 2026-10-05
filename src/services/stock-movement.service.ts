import { ValidationError } from '@/core/errors/app-error';
import { createStore } from '@/core/state/store';
import { database } from '@/database/database';
import { productRepository } from '@/database/repositories/product.repository';
import { MovementQuery, stockMovementRepository } from '@/database/repositories/stock-movement.repository';
import {
  availableQuantity,
  EntityId,
  Product,
  StockMovement,
  StockMovementEntry,
  StockMovementOrigin,
  StockMovementType,
} from '@/models';
import { notificationService } from './notifications/notification.service';

export interface MovementRequest {
  readonly productId: EntityId;
  readonly type: StockMovementType;
  /** Variation signée : > 0 pour IN, < 0 pour OUT, non nulle pour ADJUSTMENT. */
  readonly quantityDelta: number;
  readonly origin: StockMovementOrigin;
  readonly reason: string | null;
  readonly referenceId: EntityId | null;
  /**
   * false : ne pas vérifier le seuil d'alerte (livraison d'une commande, dont les unités
   * étaient déjà réservées : la quantité disponible ne change pas).
   */
  readonly notifyLowStock?: boolean;
}

export interface MovementResult {
  readonly product: Product;
  readonly movement: StockMovement;
}

export const DEFAULT_HISTORY_LIMIT = 200;

/**
 * Compteur incrémenté à chaque mouvement enregistré : les écrans d'historique
 * s'y abonnent pour se recharger, quel que soit l'écran à l'origine du mouvement.
 */
export const stockMovementVersion = createStore(0);

function assertConsistent(type: StockMovementType, delta: number): void {
  if (!Number.isSafeInteger(delta) || delta === 0) {
    throw new ValidationError('La quantité doit être un entier non nul.');
  }
  if (type === 'IN' && delta < 0) {
    throw new ValidationError('Une entrée de stock doit être positive.');
  }
  if (type === 'OUT' && delta > 0) {
    throw new ValidationError('Une sortie de stock doit être négative.');
  }
}

/**
 * Journal des mouvements de stock. C'est le seul point d'écriture de products.stock_quantity :
 * chaque variation est appliquée et tracée dans la même transaction.
 */
export const stockMovementService = {
  /**
   * Applique un mouvement. S'il est appelé depuis une transaction en cours (ex. création d'une vente),
   * il la rejoint ; sinon il ouvre la sienne.
   * Lève InsufficientStockError si le stock deviendrait négatif.
   */
  async record(request: MovementRequest): Promise<MovementResult> {
    assertConsistent(request.type, request.quantityDelta);
    const result = await database.transaction(async (tx) => {
      const product = await productRepository.applyStockDelta(request.productId, request.quantityDelta, tx);
      const movement = await stockMovementRepository.create(
        {
          productId: request.productId,
          type: request.type,
          quantityDelta: request.quantityDelta,
          quantityAfter: product.stockQuantity,
          origin: request.origin,
          reason: request.reason,
          referenceId: request.referenceId,
        },
        tx,
      );
      if (request.notifyLowStock !== false) {
        // Le stock réservé n'a pas bougé : seule la variation physique a changé le disponible.
        notificationService.checkLowStock(product, availableQuantity(product) - request.quantityDelta);
      }
      return { product, movement };
    });
    stockMovementVersion.set((version) => version + 1);
    return result;
  },

  listByProduct(productId: EntityId, limit = DEFAULT_HISTORY_LIMIT): Promise<StockMovement[]> {
    return stockMovementRepository.findByProduct(productId, limit);
  },

  listRecent(query: MovementQuery = { type: null, limit: DEFAULT_HISTORY_LIMIT }): Promise<StockMovementEntry[]> {
    return stockMovementRepository.findRecent(query);
  },

  listByReference(referenceId: EntityId): Promise<StockMovement[]> {
    return stockMovementRepository.findByReference(referenceId);
  },
};
