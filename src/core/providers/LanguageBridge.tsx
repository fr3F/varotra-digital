import { ReactNode, useEffect } from 'react';
import { languageService } from '@/core/i18n/i18n';

/** Applique la langue enregistrée dans les réglages, une fois la base ouverte. */
export function LanguageBridge({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    languageService.init().catch((error: unknown) => console.warn('[Carnet] Langue non chargée', error));
  }, []);
  return <>{children}</>;
}
