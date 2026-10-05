import { ReactNode } from 'react';

interface SingleTabGuardProps {
  readonly children: ReactNode;
}

/** Mobile : une seule instance de l'application, rien à protéger. Voir SingleTabGuard.web.tsx. */
export function SingleTabGuard({ children }: SingleTabGuardProps) {
  return <>{children}</>;
}
