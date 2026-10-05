import { toErrorMessage } from '@/core/errors/app-error';
import { createStore, Store } from './store';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EntityState<T> {
  readonly items: readonly T[];
  readonly status: LoadStatus;
  readonly error: string | null;
}

export function createEntityStore<T>(): Store<EntityState<T>> {
  return createStore<EntityState<T>>({ items: [], status: 'idle', error: null });
}

/** Charge une collection dans un store en gérant les états chargement / erreur. */
export async function loadInto<T>(
  store: Store<EntityState<T>>,
  fetcher: () => Promise<readonly T[]>,
): Promise<void> {
  store.set((state) => ({ ...state, status: 'loading', error: null }));
  try {
    const items = await fetcher();
    store.set({ items, status: 'ready', error: null });
  } catch (error: unknown) {
    store.set((state) => ({ ...state, status: 'error', error: toErrorMessage(error) }));
  }
}
