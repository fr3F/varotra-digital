import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { NEW_ENTITY_ID } from '@/core/constants/app.constants';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { isLowStock, Product } from '@/models';
import { AppButton } from '@/shared/components/AppButton';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { ListRow } from '@/shared/components/ListRow';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatMoney } from '@/utils/money.utils';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { useProducts } from './useProducts';

function openProduct(id: string): void {
  router.push({ pathname: '/products/[id]', params: { id } });
}

function ProductRow({ product }: { readonly product: Product }) {
  const low = isLowStock(product);
  return (
    <ListRow
      title={product.name}
      subtitle={[product.category, formatMoney(product.unitPrice)].filter(Boolean).join(' · ')}
      onPress={() => openProduct(product.id)}
      leading={<Thumbnail name={product.name} imageUri={product.imageUri} />}
      trailing={
        <View
          accessibilityLabel={`Stock : ${product.stockQuantity}`}
          style={[styles.stockBadge, low && styles.stockBadgeLow]}
        >
          <Text style={[styles.stockText, low && styles.stockTextLow]}>{product.stockQuantity}</Text>
        </View>
      }
    />
  );
}

export function ProductListScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const { products, categories, totalCount, lowStockCount, loading, error, reload } = useProducts({
    search,
    category,
  });

  const categoryOptions = useMemo<readonly ChipOption<string | null>[]>(
    () => [{ value: null, label: 'Toutes' }, ...categories.map((value) => ({ value, label: value }))],
    [categories],
  );
  const isFiltered = search.trim().length > 0 || category !== null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Produits' }} />
      <View style={styles.toolbar}>
        <TextInput
          accessibilityLabel="Rechercher un produit"
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher (nom, référence, catégorie)"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCorrect={false}
        />
        {categories.length > 0 ? (
          <ChipGroup
            accessibilityLabel="Filtrer par catégorie"
            options={categoryOptions}
            selected={category}
            onSelect={setCategory}
          />
        ) : null}
        <View style={styles.summary}>
          <Text style={styles.count}>
            {isFiltered ? `${products.length} sur ${totalCount} produit(s)` : `${totalCount} produit(s)`}
          </Text>
          {lowStockCount > 0 ? <Text style={styles.warning}>{lowStockCount} en stock bas</Text> : null}
        </View>
        <ErrorBanner message={error} />
      </View>

      {loading && products.length === 0 ? (
        <LoadingView />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(product) => product.id}
          renderItem={({ item }) => <ProductRow product={item} />}
          refreshing={loading}
          onRefresh={() => void reload()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={products.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <EmptyState
              title={isFiltered ? 'Aucun résultat' : 'Aucun produit'}
              message={isFiltered ? 'Essayez un autre mot ou une autre catégorie.' : 'Ajoutez votre premier produit pour commencer.'}
            />
          }
        />
      )}

      <View style={styles.footer}>
        <AppButton label="+ Nouveau produit" onPress={() => openProduct(NEW_ENTITY_ID)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
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
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: colors.textMuted, fontSize: fontSize.sm },
  warning: { color: colors.warning, fontSize: fontSize.sm, fontWeight: '600' },
  emptyList: { flexGrow: 1 },
  stockBadge: {
    minWidth: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
  },
  stockBadgeLow: { backgroundColor: colors.warningLight },
  stockText: { fontWeight: '700', color: colors.primaryDark, fontVariant: ['tabular-nums'] },
  stockTextLow: { color: colors.warning },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
