import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { Period, PERIODS, saleProfit, SaleSummary } from '@/models';
import { saleService, salesVersion } from '@/services/sale.service';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { StatCard } from '@/shared/components/StatCard';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useQuery } from '@/shared/hooks/useQuery';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { salesMessages } from './sales.messages';

function SaleRow({ summary }: { readonly summary: SaleSummary }) {
  const { sale, clientName, orderReference, itemCount } = summary;
  const t = useMessages(salesMessages);
  const common = useMessages(commonMessages);
  const profit = saleProfit(sale);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/sales/[id]', params: { id: sale.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.reference}>{sale.reference}</Text>
        <Text style={styles.client} numberOfLines={1}>
          {clientName ?? t.walkInClient}
          {orderReference !== null ? ` · ${orderReference}` : ''}
        </Text>
        <Text style={styles.meta}>
          {formatDisplayDateTime(sale.soldAt)} · {t.productCount(itemCount)} · {common.paymentMethod[sale.paymentMethod]}
        </Text>
      </View>
      <View style={styles.amounts}>
        <Text style={styles.total}>{formatMoney(sale.totalAmount)}</Text>
        <Text style={[styles.profit, profit < 0 && styles.loss]}>
          {profit >= 0 ? '+' : ''}
          {formatMoney(profit)}
        </Text>
      </View>
    </Pressable>
  );
}

export function SalesListScreen() {
  const t = useMessages(salesMessages);
  const common = useMessages(commonMessages);
  const periodOptions = useMemo<readonly ChipOption<Period>[]>(
    () => PERIODS.map((value) => ({ value, label: common.period[value] })),
    [common],
  );
  const [period, setPeriod] = useState<Period>('TODAY');
  const version = useStore(salesVersion);
  const fetchSales = useCallback(
    async () => ({ sales: await saleService.list(period), totals: await saleService.totals(period) }),
    [period],
  );
  const { data, loading, error, reload } = useQuery(fetchSales, version);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t.title }} />
      <FlatList
        data={data?.sales ?? []}
        keyExtractor={(summary) => summary.sale.id}
        renderItem={({ item }) => <SaleRow summary={item} />}
        refreshing={loading && data !== null}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.header}>
            <ChipGroup accessibilityLabel={t.periodLabel} options={periodOptions} selected={period} onSelect={setPeriod} />
            <View style={styles.grid}>
              <StatCard
                label={t.revenue}
                value={formatMoney(data?.totals.revenue ?? 0)}
                caption={t.salesCount(data?.totals.count ?? 0)}
              />
              <StatCard
                label={t.profit}
                value={formatMoney(data?.totals.profit ?? 0)}
                caption={t.costCaption(formatMoney(data?.totals.cost ?? 0))}
                tone={(data?.totals.profit ?? 0) < 0 ? 'negative' : 'positive'}
              />
            </View>
            <ErrorBanner message={error} />
          </View>
        }
        ListEmptyComponent={
          data === null ? (
            <LoadingView />
          ) : (
            <EmptyState
              icon="cash-outline"
              title={t.emptyTitle}
              message={t.emptyMessage(common.period[period])}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.background },
  rowMain: { flex: 1, gap: 2 },
  reference: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  client: { fontSize: fontSize.md, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  amounts: { alignItems: 'flex-end' },
  total: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  profit: { fontSize: fontSize.sm, fontWeight: '600', color: colors.success, fontVariant: ['tabular-nums'] },
  loss: { color: colors.danger },
});
