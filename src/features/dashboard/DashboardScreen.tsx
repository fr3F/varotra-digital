import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Href, router, Stack, useFocusEffect } from 'expo-router';
import { APP_NAME } from '@/core/constants/app.constants';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { availableQuantity, Period, PERIODS, REVENUE_GRANULARITIES, RevenueGranularity } from '@/models';
import { dashboardService } from '@/services/dashboard.service';
import { expensesVersion } from '@/services/expense.service';
import { orderStore } from '@/services/order.service';
import { salesVersion } from '@/services/sale.service';
import { stockMovementVersion } from '@/services/stock-movement.service';
import { AppButton } from '@/shared/components/AppButton';
import { BarList } from '@/shared/components/charts/BarList';
import { ColumnChart } from '@/shared/components/charts/ColumnChart';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { StatCard } from '@/shared/components/StatCard';
import { ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useQuery } from '@/shared/hooks/useQuery';
import { formatMoney } from '@/utils/money.utils';
import { dashboardMessages } from './dashboard.messages';

type ModuleKey = 'stock' | 'clients' | 'expenses' | 'sales' | 'orders' | 'products';

interface ModuleTile {
  readonly key: ModuleKey;
  readonly href: Href;
  readonly icon: ComponentProps<typeof Ionicons>['name'];
}

/** Accès rapides (les écrans principaux sont aussi dans la barre d'onglets). */
const MODULES: readonly ModuleTile[] = [
  { key: 'stock', href: '/stock', icon: 'layers-outline' },
  { key: 'clients', href: '/clients', icon: 'people-outline' },
  { key: 'expenses', href: '/expenses', icon: 'wallet-outline' },
  { key: 'sales', href: '/sales', icon: 'cash-outline' },
  { key: 'orders', href: '/orders', icon: 'receipt-outline' },
  { key: 'products', href: '/products', icon: 'cube-outline' },
];

/** Au-delà de cette largeur (tablette, web), les cartes passent sur 4 colonnes. */
const WIDE_LAYOUT = 720;

export function DashboardScreen() {
  const t = useMessages(dashboardMessages);
  const common = useMessages(commonMessages);
  const [period, setPeriod] = useState<Period>('TODAY');
  const periodOptions = useMemo<readonly ChipOption<Period>[]>(
    () => PERIODS.map((value) => ({ value, label: common.period[value] })),
    [common],
  );
  const { width } = useWindowDimensions();
  const basis = width >= WIDE_LAYOUT ? '22%' : '45%';

  // Toute écriture (vente, dépense, stock, commande) rafraîchit les indicateurs.
  const version =
    useStore(salesVersion) + useStore(expensesVersion) + useStore(stockMovementVersion) + useStore(orderStore).items.length;
  const fetchDashboard = useCallback(() => dashboardService.load(period), [period]);
  const { data, loading, error, reload } = useQuery(fetchDashboard, version);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Graphique du chiffre d'affaires : découpage choisi (jours, semaines, mois, années).
  const [granularity, setGranularity] = useState<RevenueGranularity>('DAY');
  const fetchSeries = useCallback(() => dashboardService.revenueSeries(granularity), [granularity]);
  const { data: series } = useQuery(fetchSeries, version);
  const granularityOptions = useMemo<readonly ChipOption<RevenueGranularity>[]>(
    () => REVENUE_GRANULARITIES.map((value) => ({ value, label: t.granularity[value] })),
    [t],
  );
  const chartData = useMemo(() => {
    const label = (iso: string): string => {
      const date = new Date(iso);
      const dayMonth = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      switch (granularity) {
        case 'DAY':
          return `${t.weekdaysShort[date.getDay()] ?? ''} ${date.getDate()}`;
        case 'WEEK':
          return t.weekStart(dayMonth);
        case 'MONTH':
          return t.monthsShort[date.getMonth()] ?? '';
        case 'YEAR':
          return String(date.getFullYear());
      }
    };
    return (series ?? []).map((bucket) => ({
      key: bucket.day,
      label: label(bucket.day),
      value: bucket.revenue,
      detail: t.dayDetail(formatMoney(bucket.profit), bucket.salesCount),
    }));
  }, [series, granularity, t]);
  const expenseData = useMemo(
    () =>
      (data?.expensesByCategory ?? []).map((entry) => ({
        key: entry.category,
        label: common.expenseCategory[entry.category],
        value: entry.total,
      })),
    [data, common],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, width >= WIDE_LAYOUT && styles.contentWide]}
      refreshControl={<RefreshControl refreshing={loading && data !== null} onRefresh={reload} />}
    >
      {/* À droite de l'en-tête : menu des langues (défini pour tous les écrans dans les layouts). */}
      <Stack.Screen options={{ title: APP_NAME }} />
      <ErrorBanner message={error} />
      {data === null ? (
        <LoadingView />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>{t.revenueToday}</Text>
            <Text style={styles.heroValue}>{formatMoney(data.revenueToday)}</Text>
            <Text style={styles.heroCaption}>{t.salesToday(data.salesTodayCount)}</Text>
            <View style={styles.heroActions}>
              <View style={styles.heroAction}>
                {/* Boutons clairs : un bouton « primary » se confondrait avec le bandeau. */}
                <AppButton label={common.tabs.sales} variant="secondary" onPress={() => router.push('/sales')} />
              </View>
              <View style={styles.heroAction}>
                <AppButton label={common.tabs.orders} variant="secondary" onPress={() => router.push('/orders')} />
              </View>
            </View>
          </View>

          <ChipGroup accessibilityLabel={t.period} options={periodOptions} selected={period} onSelect={setPeriod} />

          <View style={styles.grid}>
            <StatCard
              basis={basis}
              label={t.revenue}
              value={formatMoney(data.revenue)}
              caption={t.salesCount(data.salesCount)}
            />
            <StatCard
              basis={basis}
              label={t.grossProfit}
              value={formatMoney(data.grossProfit)}
              caption={t.grossProfitCaption}
              tone={data.grossProfit < 0 ? 'negative' : 'positive'}
            />
            <StatCard basis={basis} label={t.expenses} value={formatMoney(data.expenses)} />
            <StatCard
              basis={basis}
              label={t.netProfit}
              value={formatMoney(data.netProfit)}
              caption={t.netProfitCaption}
              tone={data.netProfit < 0 ? 'negative' : 'positive'}
            />
            <StatCard
              basis={basis}
              label={t.orders}
              value={String(data.ordersCreated)}
              caption={t.openOrders(data.openOrders)}
              tone={data.openOrders > 0 ? 'warning' : 'default'}
            />
            <StatCard
              basis={basis}
              label={t.lowStock}
              value={String(data.lowStockCount)}
              caption={
                data.productCount === 0
                  ? t.noProductCaption
                  : data.outOfStockCount > 0
                    ? `${t.lowStockCaption}, ${t.lowStockCaptionOut(data.outOfStockCount)}`
                    : t.lowStockCaption
              }
              tone={data.lowStockCount > 0 ? 'warning' : 'default'}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {t.revenueChart} · {t.granularityRange[granularity]}
            </Text>
            <ChipGroup
              accessibilityLabel={t.revenueChart}
              options={granularityOptions}
              selected={granularity}
              onSelect={setGranularity}
            />
            {/* key : le graphique repart sur la barre la plus récente à chaque changement de découpage. */}
            <ColumnChart key={granularity} data={chartData} formatValue={formatMoney} />
          </View>

          {expenseData.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.expensesByCategory(common.period[period])}</Text>
              <BarList data={expenseData} formatValue={formatMoney} />
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t.lowStockProducts}</Text>
              <Text accessibilityRole="link" onPress={() => router.push('/stock')} style={styles.link}>
                {t.seeStock}
              </Text>
            </View>
            {/* Message exact : aucun produit n'est pas la même chose que « stock suffisant ». */}
            {data.productCount === 0 ? (
              <Text style={styles.muted}>{t.noProducts}</Text>
            ) : data.lowStockProducts.length === 0 ? (
              <Text style={styles.muted}>{t.allAboveThreshold(data.productCount)}</Text>
            ) : (
              data.lowStockProducts.map((product) => {
                const available = availableQuantity(product);
                return (
                  <Pressable
                    key={product.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/stock/[productId]', params: { productId: product.id } })}
                    style={styles.stockRow}
                  >
                    <Text style={styles.stockName} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={[styles.stockQty, available === 0 && styles.stockOut]}>
                      {available === 0 ? t.outOfStock : t.stockOverThreshold(available, product.alertThreshold)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <Text style={styles.sectionTitle}>{t.quickAccess}</Text>
          <View style={styles.grid}>
            {MODULES.map((module) => (
              <Pressable
                key={module.key}
                accessibilityRole="button"
                onPress={() => router.push(module.href)}
                style={({ pressed }) => [styles.tile, { flexBasis: width >= WIDE_LAYOUT ? '15%' : '30%' }, pressed && styles.tilePressed]}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={module.icon} size={24} color={colors.primary} />
                </View>
                <Text style={styles.tileLabel}>{t.modules[module.key]}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  contentWide: { maxWidth: 1100, width: '100%', alignSelf: 'center' },
  hero: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.primary },
  heroLabel: { color: colors.primaryLight, fontSize: fontSize.md },
  heroValue: { color: colors.onPrimary, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroCaption: { color: colors.primaryLight, fontSize: fontSize.sm },
  heroActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  heroAction: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '600', fontSize: fontSize.sm },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  stockName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  stockQty: { fontSize: fontSize.sm, fontWeight: '700', color: colors.warning },
  stockOut: { color: colors.danger },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  tile: {
    flexGrow: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  tilePressed: { opacity: 0.8 },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tileLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
});
