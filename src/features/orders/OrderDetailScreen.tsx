import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, shadow, spacing } from '@/core/theme/theme';
import {
  isOrderDeletable,
  isOrderEditable,
  ORDER_TRANSITIONS,
  OrderDetail,
  OrderStatus,
} from '@/models';
import { orderService } from '@/services/order.service';
import { AppButton } from '@/shared/components/AppButton';
import { Drawer } from '@/shared/components/Drawer';
import { FormField } from '@/shared/components/FormField';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { confirmAction } from '@/shared/utils/confirm';
import { goBackOr } from '@/shared/utils/navigation';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { MessengerBadges } from './MessengerBadges';
import { MessengerOrderCard } from './MessengerOrderCard';
import { OrderCustomerCard } from './OrderCustomerCard';
import { ordersMessages } from './orders.messages';
import { OrderStatusBadge } from './OrderStatusBadge';

/** Variante visuelle de chaque action de statut. */
function actionVariant(target: OrderStatus): 'primary' | 'secondary' | 'danger' {
  if (target === 'CANCELLED') {
    return 'danger';
  }
  return target === 'CONFIRMED' || target === 'DELIVERED' ? 'primary' : 'secondary';
}

interface OrderDetailScreenProps {
  readonly orderId: string;
}

/**
 * Fiche commande, de haut en bas : statut, client (appel, adresse), produits et total, actions.
 * Messenger et historique restent dans des tiroirs fermés.
 */
export function OrderDetailScreen({ orderId }: OrderDetailScreenProps) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const { busy, error, run } = useAsyncAction();
  const t = useMessages(ordersMessages);
  const { orderStatus, actions } = useMessages(commonMessages);

  const refresh = useCallback(async () => {
    try {
      setDetail(await orderService.getDetail(orderId));
      setLoadError(null);
    } catch (caught: unknown) {
      setLoadError(toErrorMessage(caught));
    }
  }, [orderId]);

  // Recharge à chaque affichage (retour de l'écran de modification).
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const changeStatus = async (target: OrderStatus) => {
    const confirmation = t.actionConfirmations[target];
    if (confirmation !== undefined && !(await confirmAction(t.actionLabels[target], confirmation, actions.confirm))) {
      return;
    }
    await run(async () => {
      await orderService.changeStatus(orderId, target);
      await refresh();
    });
  };

  // Frais « à convenir » (hors Antananarivo) : saisis après l'appel, puis envoyés au client.
  const saveDeliveryFee = () =>
    run(async () => {
      await orderService.setDeliveryFee(orderId, feeInput);
      setFeeInput('');
      await refresh();
    });

  const remove = async () => {
    const message = detail?.order.stockReserved ? t.deleteReserved : t.deleteForever;
    if (!(await confirmAction(t.deleteTitle, message, actions.delete))) {
      return;
    }
    await run(async () => {
      await orderService.remove(orderId);
      goBackOr('/orders');
    });
  };

  if (detail === null) {
    return loadError === null ? <LoadingView /> : <ErrorBanner message={loadError} />;
  }

  const { order, client, lines, history, shortages } = detail;
  const hasShortage = shortages.length > 0;
  // Stock insuffisant : la commande ne peut ni être validée ni avancer tant que le manque n'est pas réglé.
  const transitions = hasShortage
    ? ORDER_TRANSITIONS[order.status].filter((target) => target === 'CANCELLED' || target === 'NEW')
    : ORDER_TRANSITIONS[order.status];
  // Ajustement possible s'il reste au moins un produit disponible après correction.
  const canAdjust =
    shortages.some((shortage) => shortage.available > 0) ||
    lines.some(({ item }) => !shortages.some((shortage) => shortage.productId === item.productId));
  const deliveryFee = order.delivery?.fee ?? null;

  const adjust = async () => {
    if (!(await confirmAction(t.adjustTitle, t.adjustMessage, t.adjustConfirm))) {
      return;
    }
    await run(async () => {
      await orderService.adjustToAvailableStock(orderId);
      await refresh();
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: order.reference }} />
      <ErrorBanner message={error} />

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.reference}>{order.reference}</Text>
          <OrderStatusBadge status={order.status} />
        </View>
        <Text style={styles.meta}>{formatDisplayDateTime(order.orderedAt)}</Text>
        <MessengerBadges order={order} />
        {order.notes ? <Text style={styles.notes}>{order.notes}</Text> : null}
      </View>

      <OrderCustomerCard order={order} client={client} />

      <View style={styles.card}>
        {lines.map(({ item, productName, productImageUri }) => (
          <View key={item.id} style={styles.line}>
            <Thumbnail name={productName} imageUri={productImageUri} size={40} />
            <View style={styles.lineTexts}>
              <Text style={styles.value} numberOfLines={1}>
                {productName}
              </Text>
              <Text style={styles.meta}>
                {item.quantity} × {formatMoney(item.unitPrice)}
              </Text>
            </View>
            <Text style={styles.lineTotal}>{formatMoney(item.lineTotal)}</Text>
          </View>
        ))}
        {deliveryFee !== null ? (
          <View style={styles.subRow}>
            <Text style={styles.meta}>{t.deliveryFee}</Text>
            <Text style={styles.subValue}>{formatMoney(deliveryFee)}</Text>
          </View>
        ) : null}
        {order.delivery !== null && deliveryFee === null ? (
          <View style={styles.feeForm}>
            <FormField
              label={t.deliveryFeeToAgree}
              value={feeInput}
              onChangeText={setFeeInput}
              placeholder="Ar"
              keyboardType="number-pad"
            />
            <AppButton
              label={t.sendDeliveryFee}
              onPress={() => void saveDeliveryFee()}
              loading={busy}
              disabled={feeInput.trim().length === 0}
            />
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{deliveryFee !== null ? t.totalWithDelivery : t.totalAmount}</Text>
          <Text style={styles.totalValue}>{formatMoney(order.totalAmount + (deliveryFee ?? 0))}</Text>
        </View>
      </View>

      {hasShortage ? (
        <View style={[styles.card, styles.shortageCard]}>
          <Text style={styles.shortageTitle}>{t.shortageTitle}</Text>
          {shortages.map((shortage) => (
            <View key={shortage.productId} style={styles.shortageRow}>
              <Text style={styles.value}>{t.shortageLine(shortage.productName, shortage.requested, shortage.available)}</Text>
              <AppButton
                label={t.addStock(shortage.productName)}
                variant="secondary"
                onPress={() => router.push({ pathname: '/stock/[productId]', params: { productId: shortage.productId } })}
                disabled={busy}
              />
            </View>
          ))}
          {canAdjust ? <AppButton label={t.adjustButton} onPress={() => void adjust()} disabled={busy} /> : null}
        </View>
      ) : null}

      {transitions.length > 0 || isOrderEditable(order.status) || isOrderDeletable(order.status) ? (
        <View style={styles.actions}>
          {transitions.map((target) => (
            <AppButton
              key={target}
              label={t.actionLabels[target]}
              variant={actionVariant(target)}
              onPress={() => void changeStatus(target)}
              disabled={busy}
            />
          ))}
          {isOrderEditable(order.status) ? (
            <AppButton
              label={t.editOrder}
              variant="secondary"
              onPress={() => router.push({ pathname: '/orders/[id]/edit', params: { id: order.id } })}
              disabled={busy}
            />
          ) : null}
          {isOrderDeletable(order.status) ? (
            <AppButton label={t.deleteOrder} variant="secondary" onPress={() => void remove()} disabled={busy} />
          ) : null}
        </View>
      ) : null}

      <MessengerOrderCard order={order} />

      <Drawer title={t.history} icon="time-outline">
        {history.map((change) => (
          <View key={change.id} style={styles.historyRow}>
            <Text style={styles.value}>
              {change.fromStatus === null
                ? t.created(orderStatus[change.toStatus])
                : `${orderStatus[change.fromStatus]} → ${orderStatus[change.toStatus]}`}
            </Text>
            <Text style={styles.meta}>{formatDisplayDateTime(change.createdAt)}</Text>
          </View>
        ))}
      </Drawer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { ...shadow, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  reference: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  notes: { marginTop: spacing.xs, fontSize: fontSize.md, fontStyle: 'italic', color: colors.text },
  value: { fontSize: fontSize.md, color: colors.text },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineTexts: { flex: 1 },
  lineTotal: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm },
  subValue: { fontSize: fontSize.md, color: colors.text, fontVariant: ['tabular-nums'] },
  feeForm: { paddingTop: spacing.md, gap: spacing.xs },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md },
  totalLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primaryDark, fontVariant: ['tabular-nums'] },
  actions: { gap: spacing.sm },
  shortageCard: { backgroundColor: colors.warningLight, gap: spacing.sm },
  shortageTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.warning },
  shortageRow: { gap: spacing.sm, paddingTop: spacing.xs },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
});
