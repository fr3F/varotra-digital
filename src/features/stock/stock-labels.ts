import { colors } from '@/core/theme/theme';
import { StockMovementOrigin, StockMovementType } from '@/models';

/**
 * Libellés français des origines, tels qu'enregistrés comme motif par défaut des mouvements :
 * sert seulement à ne pas répéter ce motif (l'affichage utilise stock.messages).
 */
export const MOVEMENT_ORIGIN_LABELS: Readonly<Record<StockMovementOrigin, string>> = {
  MANUAL: 'Manuel',
  INITIAL: 'Stock initial',
  SALE: 'Vente',
  ORDER: 'Commande',
};

export const MOVEMENT_TYPE_COLORS: Readonly<Record<StockMovementType, { text: string; background: string }>> = {
  IN: { text: colors.success, background: colors.primaryLight },
  OUT: { text: colors.danger, background: colors.dangerLight },
  ADJUSTMENT: { text: colors.warning, background: colors.warningLight },
};

/** +5 / −3 (signe moins typographique). */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
