import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '@/core/theme/theme';

export interface BarDatum {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

interface BarListProps {
  readonly data: readonly BarDatum[];
  readonly formatValue: (value: number) => string;
}

/**
 * Barres horizontales triées (une seule série) : libellé et valeur en texte,
 * barre fine proportionnelle au maximum. Lisible même sans la couleur.
 */
export function BarList({ data, formatValue }: BarListProps) {
  const max = Math.max(...data.map((datum) => datum.value), 0);
  const total = data.reduce((sum, datum) => sum + datum.value, 0);

  return (
    <View style={styles.list}>
      {data.map((datum) => {
        const share = total === 0 ? 0 : Math.round((datum.value / total) * 100);
        return (
          <View
            key={datum.key}
            accessible
            accessibilityLabel={`${datum.label} : ${formatValue(datum.value)}, ${share} %`}
            style={styles.row}
          >
            <View style={styles.texts}>
              <Text style={styles.label} numberOfLines={1}>
                {datum.label}
              </Text>
              <Text style={styles.value}>
                {formatValue(datum.value)} <Text style={styles.share}>· {share} %</Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${max === 0 ? 0 : (datum.value / max) * 100}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { gap: spacing.xs },
  texts: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  value: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  share: { fontWeight: '400', color: colors.textMuted },
  track: { height: 10 },
  bar: { height: 10, backgroundColor: colors.chart, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
});
