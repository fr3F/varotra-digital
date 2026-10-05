import { ValidationError } from '@/core/errors/app-error';
import { createEntityStore, loadInto } from '@/core/state/entity-state';
import { database } from '@/database/database';
import { productRepository } from '@/database/repositories/product.repository';
import { EntityId, Product, ProductInput } from '@/models';
import { imageStorage } from './image-storage/image-storage';
import { stockMovementService } from './stock-movement.service';

/** État réactif partagé de la liste des produits. */
export const productStore = createEntityStore<Product>();

/** Copie l'image choisie dans le stockage de l'app si elle n'y est pas déjà. */
async function persistImage(imageUri: string | null): Promise<string | null> {
  return imageUri === null ? null : imageStorage.persist(imageUri);
}

/** Supprime une image nouvellement copiée si l'enregistrement en base a échoué. */
async function discardNewImage(newUri: string | null, previousUri: string | null): Promise<void> {
  if (newUri !== null && newUri !== previousUri) {
    await imageStorage.remove(newUri);
  }
}

export const productService = {
  load(): Promise<void> {
    return loadInto(productStore, () => productRepository.findAll());
  },

  getById(id: EntityId): Promise<Product> {
    return productRepository.getById(id);
  },

  /** Crée le produit et, si besoin, son stock initial via un mouvement d'entrée (une seule transaction). */
  async create(input: ProductInput, initialStock: number): Promise<Product> {
    const imageUri = await persistImage(input.imageUri);
    try {
      const product = await database.transaction(async (tx) => {
        const created = await productRepository.create({ ...input, imageUri }, tx);
        if (initialStock <= 0) {
          return created;
        }
        // Rejoint la transaction en cours : produit et stock initial sont créés ensemble ou pas du tout.
        const { product: stocked } = await stockMovementService.record({
          productId: created.id,
          type: 'IN',
          quantityDelta: initialStock,
          origin: 'INITIAL',
          reason: 'Stock initial',
          referenceId: null,
        });
        return stocked;
      });
      await productService.load();
      return product;
    } catch (error: unknown) {
      await discardNewImage(imageUri, null);
      throw error;
    }
  },

  async update(id: EntityId, input: ProductInput): Promise<Product> {
    const previous = await productRepository.getById(id);
    const imageUri = await persistImage(input.imageUri);
    let product: Product;
    try {
      product = await productRepository.update(id, { ...input, imageUri });
    } catch (error: unknown) {
      await discardNewImage(imageUri, previous.imageUri);
      throw error;
    }
    if (previous.imageUri !== null && previous.imageUri !== imageUri) {
      await imageStorage.remove(previous.imageUri);
    }
    await productService.load();
    return product;
  },

  /**
   * Suppression logique : la ligne et son image sont conservées pour l'historique
   * des ventes et la synchronisation future.
   */
  async remove(id: EntityId): Promise<void> {
    const product = await productRepository.getById(id);
    if (product.reservedQuantity > 0) {
      throw new ValidationError(
        `« ${product.name} » a ${product.reservedQuantity} unité(s) réservée(s) par des commandes : livrez ou annulez-les avant de le supprimer.`,
      );
    }
    await productRepository.softDelete(id);
    await productService.load();
  },
};
