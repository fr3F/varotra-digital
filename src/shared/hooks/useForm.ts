import { useCallback, useState } from 'react';

/** État de formulaire typé : chaque champ est une chaîne saisie par l'utilisateur. */
export function useForm<TValues extends Readonly<Record<string, string>>>(initialValues: TValues) {
  const [values, setValues] = useState<TValues>(initialValues);

  const setField = useCallback(<K extends keyof TValues>(key: K, value: TValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  return { values, setField, reset: setValues };
}
