import { Linking, StyleSheet, Text, View } from 'react-native';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { Order } from '@/models';
import { AppButton } from '@/shared/components/AppButton';
import { formatMoney } from '@/utils/money.utils';
import { phoneDigits } from '@/utils/phone.utils';
import { ordersMessages } from './orders.messages';

/** Livraison demandée au bot Messenger : téléphone (appel direct), adresse, frais annoncés au client. */
export function DeliveryCard({ order }: { readonly order: Order }) {
  const t = useMessages(ordersMessages);
  const delivery = order.delivery;
  if (delivery === null) {
    return null;
  }
  const toAgree = delivery.fee === null;

  return (
    <View style={[styles.card, toAgree && styles.toAgree]}>
      <Text style={styles.title}>{t.deliveryTitle}</Text>

      <Text style={styles.label}>{t.deliveryPhone}</Text>
      <Text style={styles.phone} selectable>
        {delivery.phone}
      </Text>

      <Text style={styles.label}>{t.deliveryAddress}</Text>
      <Text style={styles.address} selectable>
        {delivery.address}
      </Text>

      {delivery.fee === null ? (
        <Text style={styles.warning}>{t.deliveryFeeToAgree}</Text>
      ) : (
        <>
          <Text style={styles.fee}>{t.deliveryFeeTana(formatMoney(delivery.fee))}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.totalWithDelivery}</Text>
            <Text style={styles.totalValue}>{formatMoney(order.totalAmount + delivery.fee)}</Text>
          </View>
        </>
      )}

      <AppButton label={t.callCustomer} onPress={() => void Linking.openURL(`tel:${phoneDigits(delivery.phone)}`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  toAgree: { borderColor: colors.warning },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
  phone: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  address: { fontSize: fontSize.lg, color: colors.text },
  fee: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  warning: { fontSize: fontSize.md, fontWeight: '700', color: colors.warning, marginTop: spacing.sm },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  totalLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textMuted },
  totalValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
});
