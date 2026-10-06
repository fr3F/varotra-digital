import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { EntityId } from '@/models';
import { productStore } from '@/services/product.service';
import { AppButton } from '@/shared/components/AppButton';
import { useMessages } from '@/core/i18n/i18n';
import { productsMessages } from './products.messages';

interface ProductStockCardProps {
  readonly productId: EntityId;
}

/** Quantité actuelle (toujours à jour via le store) et accès au module Stock. */
export function ProductStockCard({ productId }: ProductStockCardProps) {
  const t = useMessages(productsMessages);
  const product = useStore(productStore).items.find((item) => item.id === productId);

  return (
    <View style={styles.card}>
      <View style={styles.texts}>
        <Text style={styles.label}>{t.stockQuantity}</Text>
        <Text style={styles.quantity}>{product?.stockQuantity ?? '—'}</Text>
      </View>
      <AppButton
        label={t.manageStock}
        variant="secondary"
        onPress={() => router.push({ pathname: '/stock/[productId]', params: { productId } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  texts: { flex: 1 },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  quantity: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
});
