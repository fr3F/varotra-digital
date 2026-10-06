import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { CustomerProfile, PurchaseHistoryEntry } from '@/models';
import { customerService } from '@/services/customer.service';
import { AppButton } from '@/shared/components/AppButton';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { StatCard } from '@/shared/components/StatCard';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { confirmAction } from '@/shared/utils/confirm';
import { goBackOr } from '@/shared/utils/navigation';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { phoneDigits } from '@/utils/phone.utils';
import { OrderStatusBadge } from '../orders/OrderStatusBadge';
import { clientsMessages } from './clients.messages';

function HistoryRow({ entry }: { readonly entry: PurchaseHistoryEntry }) {
  const t = useMessages(clientsMessages);
  const isOrder = entry.kind === 'ORDER';
  const content = (
    <>
      <View style={styles.historyMain}>
        <View style={styles.historyTop}>
          <Text style={styles.historyTitle}>{isOrder ? entry.reference : t.directSale}</Text>
          {entry.status !== null ? <OrderStatusBadge status={entry.status} /> : null}
        </View>
        <Text style={styles.meta}>
          {formatDisplayDateTime(entry.occurredAt)} · {t.productCount(entry.itemCount)}
        </Text>
      </View>
      <Text
        style={[styles.historyAmount, entry.status === 'CANCELLED' && styles.cancelledAmount]}
      >
        {formatMoney(entry.amount)}
      </Text>
    </>
  );
  if (!isOrder) {
    return <View style={styles.historyRow}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: entry.id } })}
      style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

interface ClientDetailScreenProps {
  readonly clientId: string;
}

export function ClientDetailScreen({ clientId }: ClientDetailScreenProps) {
  const t = useMessages(clientsMessages);
  const common = useMessages(commonMessages);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAsyncAction();

  const refresh = useCallback(async () => {
    try {
      setProfile(await customerService.getProfile(clientId));
      setLoadError(null);
    } catch (caught: unknown) {
      setLoadError(toErrorMessage(caught));
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const remove = async () => {
    if (!(await confirmAction(t.deleteTitle, t.deleteMessage, common.actions.delete))) {
      return;
    }
    await run(async () => {
      await customerService.remove(clientId);
      goBackOr('/clients');
    });
  };

  if (profile === null) {
    return loadError === null ? <LoadingView /> : <ErrorBanner message={loadError} />;
  }

  const { client, stats, history, topProducts } = profile;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: client.name }} />
      <ErrorBanner message={error} />

      <View style={styles.card}>
        <View style={styles.identity}>
          <Thumbnail name={client.name} imageUri={null} size={64} />
          <View style={styles.identityTexts}>
            <Text style={styles.name}>{client.name}</Text>
            <Text style={styles.meta}>{t.clientSince(formatDisplayDate(client.createdAt))}</Text>
          </View>
        </View>
        <View style={styles.separator} />
        <Text style={styles.label}>{t.phone}</Text>
        <Text style={styles.value}>{client.phone ?? t.notProvided}</Text>
        <Text style={[styles.label, styles.spaced]}>{t.address}</Text>
        <Text style={styles.value}>{client.address ?? t.addressNotProvided}</Text>
        {client.notes ? (
          <>
            <Text style={[styles.label, styles.spaced]}>{t.notes}</Text>
            <Text style={styles.value}>{client.notes}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.actions}>
        {client.phone !== null ? (
          <AppButton label={t.call} onPress={() => void Linking.openURL(`tel:${phoneDigits(client.phone ?? '')}`)} />
        ) : null}
        <AppButton
          label={common.actions.edit}
          variant="secondary"
          onPress={() => router.push({ pathname: '/clients/[id]/edit', params: { id: client.id } })}
          disabled={busy}
        />
      </View>

      <View style={styles.grid}>
        <StatCard label={t.totalSpent} value={formatMoney(stats.totalSpent)} caption={t.purchaseCount(stats.purchaseCount)} />
        <StatCard label={t.averageBasket} value={formatMoney(stats.averageBasket)} />
        <StatCard
          label={t.orders}
          value={String(stats.orderCount)}
          caption={stats.openOrderCount > 0 ? t.openOrders(stats.openOrderCount) : undefined}
          tone={stats.openOrderCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label={t.lastPurchase}
          value={stats.lastPurchaseAt === null ? '—' : formatDisplayDate(stats.lastPurchaseAt)}
        />
      </View>

      {topProducts.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.topProducts}</Text>
          {topProducts.map((product) => (
            <View key={product.productId} style={styles.productRow}>
              <Text style={styles.value} numberOfLines={1}>
                {product.productName}
              </Text>
              <Text style={styles.meta}>
                {t.units(product.quantity, formatMoney(product.amount))}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.historyCard}>
        <Text style={[styles.sectionTitle, styles.historyHeader]}>{t.history}</Text>
        {history.length === 0 ? (
          <EmptyState icon="bag-outline" title={t.noPurchaseTitle} message={t.noPurchaseMessage} />
        ) : (
          history.map((entry) => <HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} />)
        )}
      </View>

      <AppButton label={t.deleteTitle} variant="danger" onPress={() => void remove()} disabled={busy} />
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
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityTexts: { flex: 1 },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  spaced: { marginTop: spacing.sm },
  value: { fontSize: fontSize.md, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  actions: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  productRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  historyHeader: { padding: spacing.lg, paddingBottom: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: { backgroundColor: colors.background },
  historyMain: { flex: 1, gap: 2 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  historyAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  cancelledAmount: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
