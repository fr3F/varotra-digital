import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';

interface SearchFieldProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
}

/** Champ de recherche en pilule : loupe à gauche, croix pour effacer. */
export function SearchField({ value, onChangeText, placeholder, accessibilityLabel }: SearchFieldProps) {
  return (
    <View style={styles.field}>
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => onChangeText('')} hitSlop={12}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.field,
  },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text, paddingVertical: spacing.sm },
});
