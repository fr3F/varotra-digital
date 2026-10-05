import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import {
  isOrderDeletable,
  isOrderEditable,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  OrderDetail,
  OrderStatus,
} from '@/models';
import { orderService } from '@/services/order.service';
import { AppButton } from '@/shared/components/AppButton';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { confirmAction } from '@/shared/utils/confirm';
import { goBackOr } from '@/shared/utils/navigation';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { ORDER_ACTION_CONFIRMATIONS, ORDER_ACTION_LABELS } from './order-labels';
import { MessengerOrderCard } from './MessengerOrderCard';
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

export function OrderDetailScreen({ orderId }: OrderDetailScreenProps) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAsyncAction();

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
    const confirmation = ORDER_ACTION_CONFIRMATIONS[target];
    if (confirmation !== undefined && !(await confirmAction(ORDER_ACTION_LABELS[target], confirmation))) {
      return;
    }
    await run(async () => {
      await orderService.changeStatus(orderId, target);
      await refresh();
    });
  };

  const remove = async () => {
    const message = detail?.order.stockReserved
      ? 'La commande sera supprimée et son stock réservé libéré.'
      : 'Supprimer définitivement cette commande ?';
    if (!(await confirmAction('Supprimer la commande', message, 'Supprimer'))) {
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

  const adjust = async () => {
    const message = 'Les quantités seront ramenées au stock disponible (produits épuisés retirés de la commande).';
    if (!(await confirmAction('Ajuster au stock disponible', message, 'Ajuster'))) {
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
        <Text style={styles.meta}>Commandée le {formatDisplayDateTime(order.orderedAt)}</Text>
        {order.stockReserved ? <Text style={styles.reserved}>Stock réservé pour cette commande</Text> : null}
        <View style={styles.separator} />
        <Text style={styles.sectionLabel}>Client</Text>
        <Text style={styles.value}>{client?.name ?? 'Client non renseigné'}</Text>
        {client?.phone ? <Text style={styles.meta}>{client.phone}</Text> : null}
        {client?.address ? <Text style={styles.meta}>{client.address}</Text> : null}
        {client !== null ? (
          <Text
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/clients/[id]', params: { id: client.id } })}
            style={styles.link}
          >
            Voir la fiche client
          </Text>
        ) : null}
        {order.notes ? (
          <>
            <Text style={[styles.sectionLabel, styles.spaced]}>Notes</Text>
            <Text style={styles.value}>{order.notes}</Text>
          </>
        ) : null}
      </View>

      <MessengerOrderCard order={order} />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Produits</Text>
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
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Montant total</Text>
          <Text style={styles.totalValue}>{formatMoney(order.totalAmount)}</Text>
        </View>
      </View>

      {hasShortage ? (
        <View style={[styles.card, styles.shortageCard]}>
          <Text style={styles.shortageTitle}>Stock insuffisant</Text>
          <Text style={styles.meta}>La commande ne peut pas être validée tant que le stock ne suffit pas.</Text>
          {shortages.map((shortage) => (
            <View key={shortage.productId} style={styles.shortageRow}>
              <Text style={styles.value}>
                {shortage.productName} : {shortage.requested} demandé(s),{' '}
                {shortage.available > 0 ? `${shortage.available} disponible(s)` : 'épuisé'}
              </Text>
              <AppButton
                label={`Ajouter du stock (${shortage.productName})`}
                variant="secondary"
                onPress={() => router.push({ pathname: '/stock/[productId]', params: { productId: shortage.productId } })}
                disabled={busy}
              />
            </View>
          ))}
          {canAdjust ? (
            <AppButton label="Ajuster au stock disponible" onPress={() => void adjust()} disabled={busy} />
          ) : null}
        </View>
      ) : null}

      {transitions.length > 0 ? (
        <View style={styles.actions}>
          <Text style={styles.sectionTitle}>Changer le statut</Text>
          {transitions.map((target) => (
            <AppButton
              key={target}
              label={ORDER_ACTION_LABELS[target]}
              variant={actionVariant(target)}
              onPress={() => void changeStatus(target)}
              disabled={busy}
            />
          ))}
        </View>
      ) : null}

      {isOrderEditable(order.status) || isOrderDeletable(order.status) ? (
        <View style={styles.actions}>
          {isOrderEditable(order.status) ? (
            <AppButton
              label="Modifier la commande"
              variant="secondary"
              onPress={() => router.push({ pathname: '/orders/[id]/edit', params: { id: order.id } })}
              disabled={busy}
            />
          ) : null}
          {isOrderDeletable(order.status) ? (
            <AppButton label="Supprimer la commande" variant="secondary" onPress={() => void remove()} disabled={busy} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Historique</Text>
        {history.map((change) => (
          <View key={change.id} style={styles.historyRow}>
            <Text style={styles.value}>
              {change.fromStatus === null
                ? `Créée (${ORDER_STATUS_LABELS[change.toStatus]})`
                : `${ORDER_STATUS_LABELS[change.fromStatus]} → ${ORDER_STATUS_LABELS[change.toStatus]}`}
            </Text>
            <Text style={styles.meta}>{formatDisplayDateTime(change.createdAt)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  reference: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  reserved: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primaryDark },
  link: { marginTop: spacing.xs, fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  spaced: { marginTop: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md },
  totalLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primaryDark, fontVariant: ['tabular-nums'] },
  actions: { gap: spacing.sm },
  shortageCard: { borderColor: colors.warning, backgroundColor: colors.warningLight, gap: spacing.sm },
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
