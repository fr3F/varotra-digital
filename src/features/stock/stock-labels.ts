import { colors } from '@/core/theme/theme';
import { StockLevel, StockMovementOrigin, StockMovementType } from '@/models';

export const MOVEMENT_TYPE_LABELS: Readonly<Record<StockMovementType, string>> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  ADJUSTMENT: 'Ajustement',
};

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

export const STOCK_LEVEL_LABELS: Readonly<Record<StockLevel, string>> = {
  OUT: 'Rupture',
  LOW: 'Stock bas',
  OK: 'Disponible',
};

/** +5 / −3 (signe moins typographique). */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
