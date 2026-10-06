import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { StockMovement } from '@/models';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { formatDelta, MOVEMENT_ORIGIN_LABELS, MOVEMENT_TYPE_COLORS } from './stock-labels';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { stockMessages } from './stock.messages';

interface MovementRowProps {
  readonly movement: StockMovement;
  /** Affiché dans l'historique global ; omis dans l'historique d'un produit. */
  readonly productName?: string;
}

export function MovementRow({ movement, productName }: MovementRowProps) {
  const t = useMessages(stockMessages);
  const common = useMessages(commonMessages);
  const palette = MOVEMENT_TYPE_COLORS[movement.type];
  // Le motif enregistré par défaut est le libellé français de l'origine : on ne le répète pas.
  const details = [
    formatDisplayDateTime(movement.createdAt),
    movement.origin !== 'MANUAL' ? t.origin[movement.origin] : null,
    movement.reason !== MOVEMENT_ORIGIN_LABELS[movement.origin] ? movement.reason : null,
  ].filter((part): part is string => part !== null && part.length > 0);

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: palette.background }]}>
        <Text style={[styles.badgeText, { color: palette.text }]}>{common.movementType[movement.type]}</Text>
      </View>
      <View style={styles.texts}>
        {productName !== undefined ? (
          <Text style={styles.title} numberOfLines={1}>
            {productName}
          </Text>
        ) : null}
        <Text style={productName !== undefined ? styles.subtitle : styles.title} numberOfLines={2}>
          {details.join(' · ')}
        </Text>
      </View>
      <View style={styles.amounts}>
        <Text
          accessibilityLabel={t.variation(formatDelta(movement.quantityDelta))}
          style={[styles.delta, { color: palette.text }]}
        >
          {formatDelta(movement.quantityDelta)}
        </Text>
        {movement.quantityAfter !== null ? <Text style={styles.after}>→ {movement.quantityAfter}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  badge: { width: 92, paddingVertical: spacing.xs, borderRadius: radius.pill, alignItems: 'center' },
  badgeText: { fontSize: fontSize.sm, fontWeight: '700' },
  texts: { flex: 1 },
  title: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  subtitle: { marginTop: 2, fontSize: fontSize.sm, color: colors.textMuted },
  amounts: { alignItems: 'flex-end' },
  delta: { fontSize: fontSize.lg, fontWeight: '700', fontVariant: ['tabular-nums'] },
  after: { fontSize: fontSize.sm, color: colors.textMuted, fontVariant: ['tabular-nums'] },
});
