import { colors } from '@/core/theme/theme';
import { OrderStatus } from '@/models';

export const ORDER_STATUS_COLORS: Readonly<Record<OrderStatus, { text: string; background: string }>> = {
  NEW: { text: colors.info, background: colors.infoLight },
  PREPARING: { text: colors.warning, background: colors.warningLight },
  CONFIRMED: { text: colors.primaryDark, background: colors.primaryLight },
  DELIVERED: { text: colors.success, background: colors.successLight },
  CANCELLED: { text: colors.textMuted, background: colors.border },
};

/** Libellé du bouton qui fait passer la commande vers ce statut. */
export const ORDER_ACTION_LABELS: Readonly<Record<OrderStatus, string>> = {
  NEW: 'Repasser en « Nouvelle »',
  PREPARING: 'Passer en préparation',
  CONFIRMED: 'Valider (réserver le stock)',
  DELIVERED: 'Marquer comme livrée',
  CANCELLED: 'Annuler la commande',
};

/** Message de confirmation pour les actions aux conséquences importantes. */
export const ORDER_ACTION_CONFIRMATIONS: Partial<Readonly<Record<OrderStatus, string>>> = {
  CONFIRMED: 'Le stock disponible sera vérifié et les quantités réservées pour cette commande.',
  DELIVERED: 'Les quantités réservées sortiront définitivement du stock. Cette action est définitive.',
  CANCELLED: 'La commande sera annulée et sa réservation de stock libérée. Cette action est définitive.',
};
