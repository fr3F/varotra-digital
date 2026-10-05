import { StyleSheet, Text, View } from 'react-native';
import { fontSize, radius, spacing } from '@/core/theme/theme';
import { ORDER_STATUS_LABELS, OrderStatus } from '@/models';
import { ORDER_STATUS_COLORS } from './order-labels';

export function OrderStatusBadge({ status }: { readonly status: OrderStatus }) {
  const palette = ORDER_STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.text }]}>{ORDER_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  text: { fontSize: fontSize.sm, fontWeight: '700' },
});
