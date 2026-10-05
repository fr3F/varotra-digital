import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Href, router, Stack, useFocusEffect } from 'expo-router';
import { APP_NAME } from '@/core/constants/app.constants';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { availableQuantity, EXPENSE_CATEGORY_LABELS, Period, PERIOD_LABELS, PERIODS } from '@/models';
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
import { formatShortDay } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';

interface ModuleTile {
  readonly label: string;
  readonly href: Href;
}

const MODULES: readonly ModuleTile[] = [
  { label: 'Ventes', href: '/sales' },
  { label: 'Commandes', href: '/orders' },
  { label: 'Produits', href: '/products' },
  { label: 'Stock', href: '/stock' },
  { label: 'Clients', href: '/clients' },
  { label: 'Dépenses', href: '/expenses' },
];

const PERIOD_OPTIONS: readonly ChipOption<Period>[] = PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }));

/** Au-delà de cette largeur (tablette, web), les cartes passent sur 4 colonnes. */
const WIDE_LAYOUT = 720;

export function DashboardScreen() {
  const [period, setPeriod] = useState<Period>('TODAY');
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

  const chartData = useMemo(
    () =>
      (data?.last7Days ?? []).map((day) => ({
        key: day.day,
        label: formatShortDay(day.day),
        value: day.revenue,
        detail: `bénéfice ${formatMoney(day.profit)} · ${day.salesCount} vente(s)`,
      })),
    [data],
  );
  const expenseData = useMemo(
    () =>
      (data?.expensesByCategory ?? []).map((entry) => ({
        key: entry.category,
        label: EXPENSE_CATEGORY_LABELS[entry.category],
        value: entry.total,
      })),
    [data],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, width >= WIDE_LAYOUT && styles.contentWide]}
      refreshControl={<RefreshControl refreshing={loading && data !== null} onRefresh={reload} />}
    >
      <Stack.Screen
        options={{
          title: APP_NAME,
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} hitSlop={12}>
              <Text style={styles.headerLink}>Réglages</Text>
            </Pressable>
          ),
        }}
      />
      <ErrorBanner message={error} />
      {data === null ? (
        <LoadingView />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Chiffre d’affaires du jour</Text>
            <Text style={styles.heroValue}>{formatMoney(data.revenueToday)}</Text>
            <Text style={styles.heroCaption}>{data.salesTodayCount} vente(s) aujourd’hui</Text>
            <View style={styles.heroActions}>
              <View style={styles.heroAction}>
                {/* Boutons clairs : un bouton « primary » se confondrait avec le bandeau. */}
                <AppButton label="+ Vente" variant="secondary" onPress={() => router.push('/sales/new')} />
              </View>
              <View style={styles.heroAction}>
                <AppButton label="+ Commande" variant="secondary" onPress={() => router.push('/orders/new')} />
              </View>
            </View>
          </View>

          <ChipGroup accessibilityLabel="Période" options={PERIOD_OPTIONS} selected={period} onSelect={setPeriod} />

          <View style={styles.grid}>
            <StatCard
              basis={basis}
              label="Chiffre d’affaires"
              value={formatMoney(data.revenue)}
              caption={`${data.salesCount} vente(s)`}
            />
            <StatCard
              basis={basis}
              label="Bénéfice brut"
              value={formatMoney(data.grossProfit)}
              caption="ventes − prix d’achat"
              tone={data.grossProfit < 0 ? 'negative' : 'positive'}
            />
            <StatCard basis={basis} label="Dépenses" value={formatMoney(data.expenses)} />
            <StatCard
              basis={basis}
              label="Bénéfice net"
              value={formatMoney(data.netProfit)}
              caption="brut − dépenses"
              tone={data.netProfit < 0 ? 'negative' : 'positive'}
            />
            <StatCard
              basis={basis}
              label="Commandes"
              value={String(data.ordersCreated)}
              caption={`${data.openOrders} en cours`}
              tone={data.openOrders > 0 ? 'warning' : 'default'}
            />
            <StatCard
              basis={basis}
              label="Stock faible"
              value={String(data.lowStockCount)}
              caption="produit(s) à réapprovisionner"
              tone={data.lowStockCount > 0 ? 'warning' : 'default'}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chiffre d’affaires · 7 derniers jours</Text>
            <ColumnChart data={chartData} formatValue={formatMoney} />
          </View>

          {expenseData.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dépenses par catégorie · {PERIOD_LABELS[period]}</Text>
              <BarList data={expenseData} formatValue={formatMoney} />
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Produits en stock faible</Text>
              <Text accessibilityRole="link" onPress={() => router.push('/stock')} style={styles.link}>
                Voir le stock
              </Text>
            </View>
            {data.lowStockProducts.length === 0 ? (
              <Text style={styles.muted}>Tous les produits sont au-dessus de leur seuil d’alerte.</Text>
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
                      {available === 0 ? 'Rupture' : `${available} / seuil ${product.alertThreshold}`}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <Text style={styles.sectionTitle}>Modules</Text>
          <View style={styles.grid}>
            {MODULES.map((module) => (
              <Pressable
                key={module.label}
                accessibilityRole="button"
                onPress={() => router.push(module.href)}
                style={({ pressed }) => [styles.tile, { flexBasis: width >= WIDE_LAYOUT ? '15%' : '30%' }, pressed && styles.tilePressed]}
              >
                <Text style={styles.tileLabel}>{module.label}</Text>
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
  headerLink: { color: colors.onPrimary, fontWeight: '600', fontSize: fontSize.md, paddingHorizontal: spacing.sm },
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
  tileLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.primaryDark },
});
