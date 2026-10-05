import { useCallback, useState } from 'react';
import { toErrorMessage } from '@/core/errors/app-error';

/**
 * Exécute une action asynchrone (enregistrement, suppression…) en exposant
 * l'état « en cours » et le message d'erreur à afficher.
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (caught: unknown) {
      setError(toErrorMessage(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, run, clearError: () => setError(null) };
}
