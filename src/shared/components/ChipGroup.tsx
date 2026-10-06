import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';

export interface ChipOption<T> {
  readonly value: T;
  readonly label: string;
}

interface ChipGroupProps<T> {
  readonly options: readonly ChipOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
}

/** Rangée horizontale de filtres à sélection unique. */
export function ChipGroup<T>({ options, selected, onSelect, accessibilityLabel }: ChipGroupProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const active = Object.is(option.value, selected);
        return (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.field,
  },
  chipActive: { backgroundColor: colors.primary },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textMuted },
  labelActive: { color: colors.onPrimary, fontWeight: '600' },
});
