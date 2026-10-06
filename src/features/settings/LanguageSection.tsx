import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { defineMessages, Language, LANGUAGE_NAMES, LANGUAGES, languageService, useLanguage, useMessages } from '@/core/i18n/i18n';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';

const messages = defineMessages(
  { title: 'Langue', hint: 'Langue de l’application. Le bot Messenger répond dans la langue de chaque client.' },
  {
    mg: { title: 'Fiteny', hint: 'Fitenin’ny fampiharana. Ny bot Messenger kosa mamaly amin’ny fitenin’ny mpividy tsirairay.' },
    en: { title: 'Language', hint: 'App language. The Messenger bot replies in each customer’s language.' },
  },
);

const OPTIONS: readonly ChipOption<Language>[] = LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }));

/** Réglages › Langue : malgache, français, anglais (appliqué immédiatement à tous les écrans). */
export function LanguageSection() {
  const t = useMessages(messages);
  const language = useLanguage();
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t.title}</Text>
      <ChipGroup
        accessibilityLabel={t.title}
        options={OPTIONS}
        selected={language}
        onSelect={(value) => void languageService.set(value)}
      />
      <Text style={styles.hint}>{t.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  hint: { fontSize: fontSize.sm, color: colors.textMuted },
});
