import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';

type StatTone = 'default' | 'positive' | 'negative' | 'warning';

interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly caption?: string;
  readonly tone?: StatTone;
  /** Largeur relative dans une grille (45 % : 2 colonnes, 22 % : 4 colonnes). */
  readonly basis?: '45%' | '22%';
}

const TONE_COLORS: Readonly<Record<StatTone, string>> = {
  default: colors.text,
  positive: colors.success,
  negative: colors.danger,
  warning: colors.warning,
};

export function StatCard({ label, value, caption, tone = 'default', basis = '45%' }: StatCardProps) {
  return (
    <View style={[styles.card, { flexBasis: basis }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: TONE_COLORS[tone] }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  value: { marginTop: spacing.xs, fontSize: fontSize.xl, fontWeight: '700', fontVariant: ['tabular-nums'] },
  caption: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.textMuted },
});
