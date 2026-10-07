import {
  defineMessages,
  Language,
  LANGUAGE_NAMES,
  LANGUAGES,
  languageService,
  useLanguage,
  useMessages,
} from '@/core/i18n/i18n';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { Drawer } from '@/shared/components/Drawer';

const messages = defineMessages(
  { title: 'Langue' },
  {
    mg: { title: 'Fiteny' },
    en: { title: 'Language' },
  },
);

const OPTIONS: readonly ChipOption<Language>[] = LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_NAMES[value],
}));

/** Réglages › Langue : malgache, français, anglais (appliqué immédiatement à tous les écrans). */
export function LanguageSection() {
  const t = useMessages(messages);
  const language = useLanguage();
  return (
    <Drawer title={t.title} icon="language-outline" summary={LANGUAGE_NAMES[language]}>
      <ChipGroup
        accessibilityLabel={t.title}
        options={OPTIONS}
        selected={language}
        onSelect={(value) => void languageService.set(value)}
      />
    </Drawer>
  );
}
