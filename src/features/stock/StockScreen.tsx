import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors, radius, spacing } from '@/core/theme/theme';
import { Product, StockLevel, stockLevelOf, StockMovementType, summarizeStock } from '@/models';
import { productStore } from '@/services/product.service';
import { stockMovementService } from '@/services/stock-movement.service';
import { useStore } from '@/core/state/store';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { ListRow } from '@/shared/components/ListRow';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { StatCard } from '@/shared/components/StatCard';
import { SearchField } from '@/shared/components/SearchField';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatMoney } from '@/utils/money.utils';
import { useProducts } from '../products/useProducts';
import { MovementRow } from './MovementRow';
import { useStockHistory } from './useStockHistory';
import { useMessages } from '@/core/i18n/i18n';
import { stockMessages } from './stock.messages';

type StockTab = 'PRODUCTS' | 'MOVEMENTS';
type LevelFilter = StockLevel | null;

const LEVEL_COLORS: Readonly<Record<StockLevel, { text: string; background: string }>> = {
  OUT: { text: colors.danger, background: colors.dangerLight },
  LOW: { text: colors.warning, background: colors.warningLight },
  OK: { text: colors.primaryDark, background: colors.primaryLight },
};

function openStock(productId: string): void {
  router.push({ pathname: '/stock/[productId]', params: { productId } });
}

function StockRow({ product }: { readonly product: Product }) {
  const t = useMessages(stockMessages);
  const level = stockLevelOf(product);
  const palette = LEVEL_COLORS[level];
  return (
    <ListRow
      title={product.name}
      subtitle={[
        t.level[level],
        product.reservedQuantity > 0 ? t.reserved(product.reservedQuantity) : null,
        t.threshold(product.alertThreshold),
      ]
        .filter(Boolean)
        .join(' · ')}
      leading={<Thumbnail name={product.name} imageUri={product.imageUri} size={40} />}
      onPress={() => openStock(product.id)}
      trailing={
        <View style={[styles.qtyBadge, { backgroundColor: palette.background }]}>
          <Text style={[styles.qtyText, { color: palette.text }]}>{product.stockQuantity}</Text>
        </View>
      }
    />
  );
}

function ProductsTab() {
  const t = useMessages(stockMessages);
  const levelOptions = useMemo<readonly ChipOption<LevelFilter>[]>(
    () => [
      { value: null, label: t.all },
      { value: 'LOW', label: t.filterLow },
      { value: 'OUT', label: t.filterOut },
    ],
    [t],
  );
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<LevelFilter>(null);
  const { products, loading, error } = useProducts({ search, category: null });
  const allProducts = useStore(productStore).items;
  const summary = useMemo(() => summarizeStock(allProducts), [allProducts]);

  const visible = useMemo(() => {
    if (level === null) {
      return products;
    }
    // « Stock bas » inclut les ruptures : ce sont les produits à réapprovisionner.
    return products.filter((product) => {
      const productLevel = stockLevelOf(product);
      return level === 'LOW' ? productLevel !== 'OK' : productLevel === level;
    });
  }, [products, level]);

  const header = (
    <View style={styles.header}>
      <View style={styles.grid}>
        <StatCard
          label={t.unitsInStock}
          value={String(summary.totalUnits)}
          caption={summary.reservedUnits > 0 ? t.reservedUnits(summary.reservedUnits) : t.productsCount(summary.productsCount)}
        />
        <StatCard label={t.valueAtCost} value={formatMoney(summary.valueAtCost)} caption={t.valueAtPrice(formatMoney(summary.valueAtPrice))} />
        <StatCard label={t.lowStock} value={String(summary.lowStockCount)} tone={summary.lowStockCount > 0 ? 'warning' : 'default'} />
        <StatCard label={t.outOfStock} value={String(summary.outOfStockCount)} tone={summary.outOfStockCount > 0 ? 'negative' : 'default'} />
      </View>
      <SearchField accessibilityLabel={t.searchLabel} value={search} onChangeText={setSearch} placeholder={t.searchPlaceholder} />
      <ChipGroup accessibilityLabel={t.levelFilter} options={levelOptions} selected={level} onSelect={setLevel} />
      <ErrorBanner message={error} />
    </View>
  );

  if (loading && allProducts.length === 0) {
    return <LoadingView />;
  }

  return (
    <FlatList
      data={visible}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => <StockRow product={item} />}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <EmptyState
          icon="layers-outline"
          title={allProducts.length === 0 ? t.noProduct : t.noResult}
          message={allProducts.length === 0 ? t.noProductHint : undefined}
        />
      }
    />
  );
}

function MovementsTab() {
  const t = useMessages(stockMessages);
  const typeOptions = useMemo<readonly ChipOption<StockMovementType | null>[]>(
    () => [
      { value: null, label: t.all },
      { value: 'IN', label: t.typeIn },
      { value: 'OUT', label: t.typeOut },
      { value: 'ADJUSTMENT', label: t.typeAdjustment },
    ],
    [t],
  );
  const [type, setType] = useState<StockMovementType | null>(null);
  const fetchRecent = useCallback(() => stockMovementService.listRecent({ type, limit: 200 }), [type]);
  const history = useStockHistory(fetchRecent);

  return (
    <FlatList
      data={history.items}
      keyExtractor={(entry) => entry.movement.id}
      renderItem={({ item }) => (
        <MovementRow
          movement={item.movement}
          productName={item.productDeleted ? t.deleted(item.productName) : item.productName}
        />
      )}
      refreshing={history.loading}
      onRefresh={history.reload}
      ListHeaderComponent={
        <View style={styles.header}>
          <ChipGroup accessibilityLabel={t.typeFilter} options={typeOptions} selected={type} onSelect={setType} />
          <ErrorBanner message={history.error} />
        </View>
      }
      ListEmptyComponent={
        history.loading ? null : <EmptyState icon="swap-vertical-outline" title={t.noMovement} message={t.noMovementHint} />
      }
    />
  );
}

export function StockScreen() {
  const t = useMessages(stockMessages);
  const tabOptions = useMemo<readonly ChipOption<StockTab>[]>(
    () => [
      { value: 'PRODUCTS', label: t.tabProducts },
      { value: 'MOVEMENTS', label: t.tabMovements },
    ],
    [t],
  );
  const [tab, setTab] = useState<StockTab>('PRODUCTS');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t.title }} />
      <View style={styles.tabs}>
        <ChipGroup accessibilityLabel={t.view} options={tabOptions} selected={tab} onSelect={setTab} />
      </View>
      {tab === 'PRODUCTS' ? <ProductsTab /> : <MovementsTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabs: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  header: { padding: spacing.lg, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  qtyBadge: {
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  qtyText: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
