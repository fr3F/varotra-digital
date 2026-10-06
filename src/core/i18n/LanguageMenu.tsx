import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, radius, shadow, spacing } from '@/core/theme/theme';
import { defineMessages, Language, LANGUAGE_NAMES, LANGUAGES, languageService, useLanguage, useMessages } from './i18n';

/** Drapeau de chaque langue (anglais : Royaume-Uni). */
export const LANGUAGE_FLAGS: Readonly<Record<Language, string>> = {
  mg: '🇲🇬',
  fr: '🇫🇷',
  en: '🇬🇧',
};

const messages = defineMessages(
  { open: 'Changer de langue', title: 'Langue' },
  {
    mg: { open: 'Hanova fiteny', title: 'Fiteny' },
    en: { open: 'Change language', title: 'Language' },
  },
);

/** Hauteur approximative d'un en-tête : le menu s'ouvre juste en dessous. */
const HEADER_HEIGHT = 56;

/**
 * Bouton « langue » de l'en-tête : drapeau de la langue courante ; un appui ouvre un menu déroulant
 * (🇲🇬 Malagasy, 🇫🇷 Français, 🇬🇧 English). Le choix s'applique à tous les écrans et est enregistré.
 */
export function LanguageMenu() {
  const t = useMessages(messages);
  const language = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const choose = (value: Language) => {
    setOpen(false);
    void languageService.set(value);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.open} (${LANGUAGE_NAMES[language]})`}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons name="language" size={20} color={colors.primary} />
        <Text style={styles.triggerFlag}>{LANGUAGE_FLAGS[language]}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel={t.open} style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: insets.top + HEADER_HEIGHT }]}>
            <Text style={styles.menuTitle}>{t.title}</Text>
            {LANGUAGES.map((value) => {
              const selected = value === language;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  onPress={() => choose(value)}
                  style={({ pressed }) => [styles.item, selected && styles.itemSelected, pressed && styles.pressed]}
                >
                  <Text style={styles.flag}>{LANGUAGE_FLAGS[value]}</Text>
                  <Text style={[styles.itemLabel, selected && styles.itemLabelSelected]}>{LANGUAGE_NAMES[value]}</Text>
                  {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  triggerFlag: { fontSize: fontSize.md },
  pressed: { opacity: 0.7 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  menu: {
    ...shadow,
    position: 'absolute',
    right: spacing.lg,
    minWidth: 200,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    elevation: 8,
  },
  menuTitle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textMuted,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  itemSelected: { backgroundColor: colors.primaryLight },
  flag: { fontSize: 22 },
  itemLabel: { flex: 1, fontSize: fontSize.md, color: colors.text },
  itemLabelSelected: { fontWeight: '700', color: colors.primary },
});
