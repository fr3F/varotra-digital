import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontSize, radius, spacing } from '@/core/theme/theme';
import { ORDER_STATUS_LABELS, OrderStatus } from '@/models';
import { ORDER_STATUS_COLORS } from './order-labels';

/** Une icône par statut : le statut se reconnaît sans lire. */
const STATUS_ICONS: Readonly<Record<OrderStatus, ComponentProps<typeof Ionicons>['name']>> = {
  NEW: 'sparkles',
  PREPARING: 'cube',
  CONFIRMED: 'checkmark-circle',
  DELIVERED: 'bicycle',
  CANCELLED: 'close-circle',
};

export function OrderStatusBadge({ status }: { readonly status: OrderStatus }) {
  const palette = ORDER_STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Ionicons name={STATUS_ICONS[status]} size={14} color={palette.text} />
      <Text style={[styles.text, { color: palette.text }]}>{ORDER_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fontSize.sm, fontWeight: '700' },
});
