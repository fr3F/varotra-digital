import { useEffect, useMemo } from 'react';
import { useStore } from '@/core/state/store';
import { isLowStock, Product } from '@/models';
import { productService, productStore } from '@/services/product.service';

export interface ProductFilters {
  /** Recherche libre sur le nom, la référence et la catégorie. */
  readonly search: string;
  /** null = toutes les catégories. */
  readonly category: string | null;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}

function matchesSearch(product: Product, query: string): boolean {
  return [product.name, product.sku, product.category].some(
    (field) => field !== null && normalize(field).includes(query),
  );
}

/** Liste réactive des produits avec recherche (insensible aux accents) et filtre par catégorie. */
export function useProducts({ search, category }: ProductFilters) {
  const state = useStore(productStore);

  useEffect(() => {
    if (state.status === 'idle') {
      void productService.load();
    }
  }, [state.status]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    state.items.forEach((product) => {
      if (product.category !== null) {
        unique.add(product.category);
      }
    });
    return [...unique].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [state.items]);

  const products = useMemo(() => {
    const query = normalize(search);
    return state.items.filter(
      (product) =>
        (category === null || product.category === category) && (query.length === 0 || matchesSearch(product, query)),
    );
  }, [state.items, search, category]);

  const lowStockCount = useMemo(() => state.items.filter(isLowStock).length, [state.items]);

  return {
    products,
    categories,
    totalCount: state.items.length,
    lowStockCount,
    loading: state.status === 'idle' || state.status === 'loading',
    error: state.error,
    reload: productService.load,
  };
}
