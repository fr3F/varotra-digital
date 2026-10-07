import { ComponentProps, ReactNode, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, shadow, spacing } from '@/core/theme/theme';

interface DrawerProps {
  readonly title: string;
  readonly icon: ComponentProps<typeof Ionicons>['name'];
  /** Résumé court affiché fermé (ex. langue choisie, nom de la boutique). */
  readonly summary?: string | null;
  readonly tone?: 'default' | 'danger';
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

/** Tiroir : un en-tête toujours visible, le contenu s'ouvre au toucher (écrans de réglages aérés). */
export function Drawer({ title, icon, summary, tone = 'default', defaultOpen = false, children }: DrawerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const accent = tone === 'danger' ? colors.danger : colors.primary;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Ionicons name={icon} size={22} color={accent} />
        <View style={styles.texts}>
          <Text style={[styles.title, tone === 'danger' && { color: colors.danger }]} numberOfLines={1}>
            {title}
          </Text>
          {summary ? (
            <Text style={styles.summary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadow, borderRadius: radius.lg, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.85 },
  texts: { flex: 1 },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  summary: { marginTop: 2, fontSize: fontSize.sm, color: colors.textMuted },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
