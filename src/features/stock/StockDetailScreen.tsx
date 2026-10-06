import { useCallback, useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { availableQuantity, stockLevelOf } from '@/models';
import { productService, productStore } from '@/services/product.service';
import { stockMovementService } from '@/services/stock-movement.service';
import { AppButton } from '@/shared/components/AppButton';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatMoney } from '@/utils/money.utils';
import { MovementRow } from './MovementRow';
import { StockMovementForm } from './StockMovementForm';
import { useStockHistory } from './useStockHistory';
import { useMessages } from '@/core/i18n/i18n';
import { stockMessages } from './stock.messages';

const LEVEL_COLORS = { OUT: colors.danger, LOW: colors.warning, OK: colors.success } as const;

interface StockDetailScreenProps {
  readonly productId: string;
}

export function StockDetailScreen({ productId }: StockDetailScreenProps) {
  const t = useMessages(stockMessages);
  const productState = useStore(productStore);
  const product = productState.items.find((item) => item.id === productId) ?? null;

  useEffect(() => {
    if (productState.status === 'idle') {
      void productService.load();
    }
  }, [productState.status]);

  const fetchHistory = useCallback(() => stockMovementService.listByProduct(productId), [productId]);
  const history = useStockHistory(fetchHistory);

  if (product === null) {
    if (productState.status === 'ready') {
      return <EmptyState icon="help-circle-outline" title={t.productNotFound} message={t.productNotFoundHint} />;
    }
    return productState.error !== null ? <ErrorBanner message={productState.error} /> : <LoadingView />;
  }

  const level = stockLevelOf(product);

  const header = (
    <View style={styles.header}>
      <View style={styles.summary}>
        <Thumbnail name={product.name} imageUri={product.imageUri} size={72} />
        <View style={styles.summaryTexts}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={[styles.level, { color: LEVEL_COLORS[level] }]}>
            {t.levelWithThreshold(t.level[level], product.alertThreshold)}
          </Text>
          {product.reservedQuantity > 0 ? (
            <Text style={styles.value}>
              {t.reservedAvailable(product.reservedQuantity, availableQuantity(product))}
            </Text>
          ) : null}
          <Text style={styles.value}>{t.value(formatMoney(product.stockQuantity * product.costPrice))}</Text>
        </View>
        <View style={styles.quantityBox}>
          <Text accessibilityLabel={t.currentQuantity(product.stockQuantity)} style={styles.quantity}>
            {product.stockQuantity}
          </Text>
          <Text style={styles.quantityLabel}>{t.inStock}</Text>
        </View>
      </View>

      <StockMovementForm product={product} />

      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>{t.history}</Text>
        <AppButton
          label={t.productSheet}
          variant="secondary"
          onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })}
        />
      </View>
      <ErrorBanner message={history.error} />
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t.titleFor(product.name) }} />
      <FlatList
        data={history.items}
        keyExtractor={(movement) => movement.id}
        renderItem={({ item }) => <MovementRow movement={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          history.loading ? null : <EmptyState icon="swap-vertical-outline" title={t.noMovement} message={t.noMovementProductHint} />
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  header: { padding: spacing.lg, gap: spacing.lg },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTexts: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  level: { fontSize: fontSize.sm, fontWeight: '600' },
  value: { fontSize: fontSize.sm, color: colors.textMuted },
  quantityBox: { alignItems: 'center', minWidth: 64 },
  quantity: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  quantityLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionTitle: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text },
});
