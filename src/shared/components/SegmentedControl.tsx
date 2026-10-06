import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';

export interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedControlProps<T> {
  readonly options: readonly SegmentOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
}

/** Choix exclusif sur une seule ligne (segments de même largeur dans une pilule grise). */
export function SegmentedControl<T>({ options, selected, onSelect, accessibilityLabel }: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((option) => {
        const active = Object.is(option.value, selected);
        return (
          <Pressable
            key={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.field },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
  },
  segmentActive: { backgroundColor: colors.primary },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  labelActive: { color: colors.onPrimary, fontWeight: '700' },
});
