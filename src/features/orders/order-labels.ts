import { colors } from '@/core/theme/theme';
import { OrderStatus } from '@/models';

export const ORDER_STATUS_COLORS: Readonly<Record<OrderStatus, { text: string; background: string }>> = {
  NEW: { text: colors.info, background: colors.infoLight },
  PREPARING: { text: colors.warning, background: colors.warningLight },
  CONFIRMED: { text: colors.primaryDark, background: colors.primaryLight },
  DELIVERED: { text: colors.success, background: colors.successLight },
  CANCELLED: { text: colors.textMuted, background: colors.border },
};
