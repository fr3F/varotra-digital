import { useSyncExternalStore } from 'react';

type Listener = () => void;
type Updater<T> = T | ((previous: T) => T);

/**
 * Petit store réactif (équivalent d'un signal) : une valeur immuable,
 * des abonnés notifiés à chaque changement.
 */
export interface Store<T> {
  get(): T;
  set(next: Updater<T>): void;
  subscribe(listener: Listener): () => void;
}

function isUpdaterFunction<T>(next: Updater<T>): next is (previous: T) => T {
  return typeof next === 'function';
}

export function createStore<T>(initialValue: T): Store<T> {
  let value = initialValue;
  const listeners = new Set<Listener>();

  return {
    get: () => value,
    set: (next) => {
      const resolved = isUpdaterFunction(next) ? next(value) : next;
      if (Object.is(resolved, value)) {
        return;
      }
      value = resolved;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Abonne un composant React à un store. Les valeurs dérivées se calculent avec useMemo. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
