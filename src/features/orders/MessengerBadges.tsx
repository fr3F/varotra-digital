import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/core/theme/theme';
import { useMessages } from '@/core/i18n/i18n';
import { Order } from '@/models';
import { ordersMessages } from './orders.messages';

function Badge({ label, text, background }: { readonly label: string; readonly text: string; readonly background: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

/**
 * Origine Messenger et résultat de la vérification automatique du stock.
 * Le texte porte l'information : la couleur n'est qu'un repère.
 */
export function MessengerBadges({ order }: { readonly order: Order }) {
  const t = useMessages(ordersMessages);
  if (order.source !== 'MESSENGER') {
    return null;
  }
  return (
    <View style={styles.row}>
      <Badge label={t.badgeMessenger} text={colors.info} background={colors.infoLight} />
      {order.needsReview ? <Badge label={t.badgeReview} text={colors.danger} background={colors.dangerLight} /> : null}
      {order.stockCheck === 'OK' ? <Badge label={t.badgeStockOk} text={colors.success} background={colors.successLight} /> : null}
      {order.stockCheck === 'SHORTAGE' ? (
        <Badge label={t.badgeShortage} text={colors.warning} background={colors.warningLight} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  text: { fontSize: 12, fontWeight: '700' },
});
