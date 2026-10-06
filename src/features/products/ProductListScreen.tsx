import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { NEW_ENTITY_ID } from '@/core/constants/app.constants';
import { colors, fontSize, radius, shadow, spacing } from '@/core/theme/theme';
import { isLowStock, Product } from '@/models';
import { AppButton } from '@/shared/components/AppButton';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { SearchField } from '@/shared/components/SearchField';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatMoney } from '@/utils/money.utils';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { useProducts } from './useProducts';

function openProduct(id: string): void {
  router.push({ pathname: '/products/[id]', params: { id } });
}

/** Carte produit (modèle « Bite ») : photo, nom, stock, prix en rouge. */
function ProductCard({ product }: { readonly product: Product }) {
  const low = isLowStock(product);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatMoney(product.unitPrice)}, stock ${product.stockQuantity}`}
      onPress={() => openProduct(product.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.photo}>
        <Thumbnail name={product.name} imageUri={product.imageUri} size={CARD_IMAGE_SIZE} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={[styles.stock, low && styles.stockLow]}>
        {low ? '🔥 ' : ''}
        {product.stockQuantity} en stock
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.price}>{formatMoney(product.unitPrice)}</Text>
        <Ionicons name="create-outline" size={18} color={colors.primary} />
      </View>
    </Pressable>
  );
}

/** Côté de la photo dans une carte (deux cartes par ligne). */
const CARD_IMAGE_SIZE = 140;

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
        <SearchField accessibilityLabel="Rechercher un produit" value={search} onChangeText={setSearch} placeholder="Rechercher (nom, référence, catégorie)" />
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
          renderItem={({ item }) => <ProductCard product={item} />}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          refreshing={loading}
          onRefresh={() => void reload()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={products.length === 0 ? styles.emptyList : styles.grid}
          ListEmptyComponent={
            <EmptyState
              icon={isFiltered ? 'search-outline' : 'pricetags-outline'}
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
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: colors.textMuted, fontSize: fontSize.sm },
  warning: { color: colors.warning, fontSize: fontSize.sm, fontWeight: '600' },
  emptyList: { flexGrow: 1 },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  gridRow: { gap: spacing.md },
  card: {
    ...shadow,
    flex: 1,
    maxWidth: '50%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: 2,
  },
  cardPressed: { opacity: 0.85 },
  photo: { alignItems: 'center', marginBottom: spacing.xs, overflow: 'hidden', borderRadius: radius.lg },
  name: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  stock: { fontSize: fontSize.sm, color: colors.textMuted },
  stockLow: { color: colors.warning, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  price: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
