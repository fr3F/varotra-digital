import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '@/core/errors/app-error';

/**
 * Charge une donnée asynchrone et la recharge quand `fetcher` change (filtres)
 * ou quand `version` change (une écriture a eu lieu ailleurs dans l'application).
 * Les données précédentes restent affichées pendant un rechargement.
 */
export function useQuery<T>(fetcher: () => Promise<T>, version = 0) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetcher()
      .then((result) => {
        if (active) {
          setData(result);
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

  const reload = useCallback(() => {
    setLoading(true);
    setRefreshKey((key) => key + 1);
  }, []);

  return { data, loading, error, reload };
}
