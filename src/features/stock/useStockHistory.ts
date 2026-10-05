import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '@/core/errors/app-error';
import { useStore } from '@/core/state/store';
import { stockMovementVersion } from '@/services/stock-movement.service';

/**
 * Charge un historique de mouvements et le recharge automatiquement
 * dès qu'un mouvement est enregistré n'importe où dans l'application.
 */
export function useStockHistory<T>(fetcher: () => Promise<T[]>) {
  const version = useStore(stockMovementVersion);
  const [refreshKey, setRefreshKey] = useState(0);
  const [items, setItems] = useState<readonly T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetcher()
      .then((result) => {
        if (active) {
          setItems(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(toErrorMessage(caught));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [fetcher, version, refreshKey]);

  /** Rechargement demandé par l'utilisateur (tirer pour actualiser). */
  const reload = useCallback(() => {
    setLoading(true);
    setRefreshKey((key) => key + 1);
  }, []);

  return { items, loading, error, reload };
}
