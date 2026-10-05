import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { Product, StockLevel, stockLevelOf, StockMovementType, summarizeStock } from '@/models';
import { productStore } from '@/services/product.service';
import { stockMovementService } from '@/services/stock-movement.service';
import { useStore } from '@/core/state/store';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { ListRow } from '@/shared/components/ListRow';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { StatCard } from '@/shared/components/StatCard';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatMoney } from '@/utils/money.utils';
import { useProducts } from '../products/useProducts';
import { MovementRow } from './MovementRow';
import { STOCK_LEVEL_LABELS } from './stock-labels';
import { useStockHistory } from './useStockHistory';

type StockTab = 'PRODUCTS' | 'MOVEMENTS';
type LevelFilter = StockLevel | null;

const TAB_OPTIONS: readonly ChipOption<StockTab>[] = [
  { value: 'PRODUCTS', label: 'Produits' },
  { value: 'MOVEMENTS', label: 'Mouvements' },
];

const LEVEL_OPTIONS: readonly ChipOption<LevelFilter>[] = [
  { value: null, label: 'Tous' },
  { value: 'LOW', label: 'Stock bas' },
  { value: 'OUT', label: 'Rupture' },
];

const TYPE_OPTIONS: readonly ChipOption<StockMovementType | null>[] = [
  { value: null, label: 'Tous' },
  { value: 'IN', label: 'Entrées' },
  { value: 'OUT', label: 'Sorties' },
  { value: 'ADJUSTMENT', label: 'Ajustements' },
];

const LEVEL_COLORS: Readonly<Record<StockLevel, { text: string; background: string }>> = {
  OUT: { text: colors.danger, background: colors.dangerLight },
  LOW: { text: colors.warning, background: colors.warningLight },
  OK: { text: colors.primaryDark, background: colors.primaryLight },
};

function openStock(productId: string): void {
  router.push({ pathname: '/stock/[productId]', params: { productId } });
}

function StockRow({ product }: { readonly product: Product }) {
  const level = stockLevelOf(product);
  const palette = LEVEL_COLORS[level];
  return (
    <ListRow
      title={product.name}
      subtitle={[
        STOCK_LEVEL_LABELS[level],
        product.reservedQuantity > 0 ? `${product.reservedQuantity} réservé(s)` : null,
        `seuil ${product.alertThreshold}`,
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
        <StatCard label="Unités en stock" value={String(summary.totalUnits)} caption={
            summary.reservedUnits > 0
              ? `dont ${summary.reservedUnits} réservée(s)`
              : `${summary.productsCount} produit(s)`
          }
        />
        <StatCard label="Valeur (achat)" value={formatMoney(summary.valueAtCost)} caption={`vente : ${formatMoney(summary.valueAtPrice)}`} />
        <StatCard label="Stock bas" value={String(summary.lowStockCount)} tone={summary.lowStockCount > 0 ? 'warning' : 'default'} />
        <StatCard label="Ruptures" value={String(summary.outOfStockCount)} tone={summary.outOfStockCount > 0 ? 'negative' : 'default'} />
      </View>
      <TextInput
        accessibilityLabel="Rechercher dans le stock"
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher un produit"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        autoCorrect={false}
      />
      <ChipGroup accessibilityLabel="Filtrer par niveau de stock" options={LEVEL_OPTIONS} selected={level} onSelect={setLevel} />
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
          title={allProducts.length === 0 ? 'Aucun produit' : 'Aucun résultat'}
          message={allProducts.length === 0 ? 'Créez un produit pour suivre son stock.' : undefined}
        />
      }
    />
  );
}

function MovementsTab() {
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
          productName={item.productDeleted ? `${item.productName} (supprimé)` : item.productName}
        />
      )}
      refreshing={history.loading}
      onRefresh={history.reload}
      ListHeaderComponent={
        <View style={styles.header}>
          <ChipGroup accessibilityLabel="Filtrer par type de mouvement" options={TYPE_OPTIONS} selected={type} onSelect={setType} />
          <ErrorBanner message={history.error} />
        </View>
      }
      ListEmptyComponent={
        history.loading ? null : <EmptyState title="Aucun mouvement" message="Les entrées et sorties de stock apparaîtront ici." />
      }
    />
  );
}

export function StockScreen() {
  const [tab, setTab] = useState<StockTab>('PRODUCTS');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Stock' }} />
      <View style={styles.tabs}>
        <ChipGroup accessibilityLabel="Vue du stock" options={TAB_OPTIONS} selected={tab} onSelect={setTab} />
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
  search: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  qtyBadge: {
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  qtyText: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
