import { useState } from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';

interface FormFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly multiline?: boolean;
  readonly required?: boolean;
  readonly hint?: string;
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  required = false,
  hint,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, multiline && styles.multiline, focused && styles.focused]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.xs + 2 },
  required: { color: colors.primary },
  // Champ gris clair arrondi ; bordure rouge quand il est actif (on voit où l'on écrit).
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    backgroundColor: colors.field,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  focused: { borderColor: colors.primary, backgroundColor: colors.surface },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  hint: { marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.textMuted },
});
