import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';

interface NumberStepperProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  readonly accessibilityLabel: string;
  readonly decrementLabel: string;
  readonly incrementLabel: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Nombre modifiable : boutons − / + et champ numérique (saisie libre, ramenée entre min et max).
 * Chaque valeur valide est appliquée tout de suite ; un champ vide reprend la valeur courante en quittant.
 */
export function NumberStepper({ value, min, max, onChange, accessibilityLabel, decrementLabel, incrementLabel }: NumberStepperProps) {
  // Texte en cours de saisie ; null hors saisie : le champ affiche alors la valeur courante.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);

  const typed = (input: string) => {
    const digits = input.replace(/\D/g, '').slice(0, 3);
    setDraft(digits);
    const parsed = Number(digits);
    if (digits.length > 0 && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const commit = () => {
    const parsed = Number(text);
    const next = text.length === 0 || !Number.isFinite(parsed) ? value : clamp(parsed, min, max);
    setDraft(null);
    if (next !== value) {
      onChange(next);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        disabled={value <= min}
        onPress={() => onChange(clamp(value - 1, min, max))}
        hitSlop={6}
        style={({ pressed }) => [styles.button, value <= min && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="remove" size={20} color={colors.primary} />
      </Pressable>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={text}
        onChangeText={typed}
        onFocus={() => setDraft(String(value))}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={3}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={incrementLabel}
        disabled={value >= max}
        onPress={() => onChange(clamp(value + 1, min, max))}
        hitSlop={6}
        style={({ pressed }) => [styles.button, value >= max && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  input: {
    width: 60,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    textAlign: 'center',
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
