import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '@/core/theme/theme';

export interface ColumnDatum {
  readonly key: string;
  /** Libellé sous la colonne (ex. « lun. 28 »). */
  readonly label: string;
  /** Libellé complet au-dessus du graphique quand `label` est abrégé (ex. « mar. 6 » pour « 6 »). */
  readonly fullLabel?: string;
  readonly value: number;
  /** Détail affiché quand la colonne est sélectionnée. */
  readonly detail?: string;
}

interface ColumnChartProps {
  readonly data: readonly ColumnDatum[];
  readonly formatValue: (value: number) => string;
  readonly height?: number;
  /** Colonne sélectionnée par défaut (la plus récente si omis). */
  readonly initialKey?: string;
}

const BAR_MAX_WIDTH = 24;
const DATA_END_RADIUS = 4;

/** Nombre maximal d'étiquettes sous l'axe. */
const MAX_LABELS = 10;
/** Largeur d'une étiquette quand elles sont espacées (centrée sous sa colonne). */
const SPARSE_LABEL_WIDTH = 48;

/**
 * Histogramme simple, une seule série : colonnes fines posées sur une ligne de base,
 * extrémité arrondie de 4 px. Seule la colonne sélectionnée porte son libellé de valeur ;
 * toucher une colonne la sélectionne (équivalent mobile du survol).
 */
export function ColumnChart({ data, formatValue, height = 140, initialKey }: ColumnChartProps) {
  const [selectedKey, setSelectedKey] = useState(initialKey ?? data[data.length - 1]?.key ?? null);
  const max = Math.max(...data.map((datum) => datum.value), 0);
  const selected = data.find((datum) => datum.key === selectedKey) ?? null;
  // Beaucoup de barres (ex. 30 jours) : une étiquette sur N pour qu'elles restent lisibles.
  const labelStep = Math.max(1, Math.ceil(data.length / MAX_LABELS));

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>{selected === null ? '—' : formatValue(selected.value)}</Text>
        <Text style={styles.readoutLabel}>
          {selected === null ? '' : [selected.fullLabel ?? selected.label, selected.detail].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={[styles.plot, { height }]}>
        {data.map((datum) => {
          const isSelected = datum.key === selectedKey;
          // Une valeur non nulle reste visible (2 px minimum).
          const barHeight = max === 0 ? 0 : Math.max((datum.value / max) * height, datum.value > 0 ? 2 : 0);
          return (
            <Pressable
              key={datum.key}
              accessibilityRole="button"
              accessibilityLabel={`${datum.label} : ${formatValue(datum.value)}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedKey(datum.key)}
              // Zone de toucher : toute la hauteur de la colonne, plus large que la barre.
              style={styles.slot}
            >
              <View
                style={[
                  styles.bar,
                  { height: barHeight, opacity: selectedKey === null || isSelected ? 1 : 0.55 },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.baseline} />
      {labelStep === 1 ? (
        <View style={styles.labels}>
          {data.map((datum) => (
            <Text
              key={datum.key}
              style={[styles.label, styles.labelFlex, datum.key === selectedKey && styles.labelSelected]}
              numberOfLines={1}
            >
              {datum.label}
            </Text>
          ))}
        </View>
      ) : (
        // Beaucoup de colonnes : une étiquette sur N, centrée sous sa colonne et libre de déborder.
        <View style={styles.labelsSparse}>
          {data.map((datum, index) => {
            const isSelected = datum.key === selectedKey;
            if (!isSelected && (data.length - 1 - index) % labelStep !== 0) {
              return null;
            }
            return (
              <Text
                key={datum.key}
                style={[
                  styles.label,
                  styles.labelAbsolute,
                  { left: `${((index + 0.5) / data.length) * 100}%` },
                  isSelected && styles.labelSelected,
                ]}
                numberOfLines={1}
              >
                {datum.label}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { marginBottom: spacing.md },
  readoutValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  readoutLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: {
    width: '70%',
    maxWidth: BAR_MAX_WIDTH,
    backgroundColor: colors.chart,
    borderTopLeftRadius: DATA_END_RADIUS,
    borderTopRightRadius: DATA_END_RADIUS,
  },
  baseline: { height: 1, backgroundColor: colors.chartAxis },
  labels: { flexDirection: 'row', gap: 2, marginTop: spacing.xs },
  labelsSparse: { height: 16, marginTop: spacing.xs },
  label: { textAlign: 'center', fontSize: 11, color: colors.textMuted },
  labelFlex: { flex: 1 },
  labelAbsolute: { position: 'absolute', width: SPARSE_LABEL_WIDTH, marginLeft: -SPARSE_LABEL_WIDTH / 2 },
  labelSelected: { color: colors.text, fontWeight: '700' },
});
