import { getLocales } from 'expo-localization';
import { createStore, useStore } from '@/core/state/store';
import { settingsRepository } from '@/database/repositories/settings.repository';

/**
 * Langues de l'interface : malgache, français, anglais.
 *
 * Chaque écran déclare ses textes avec `defineMessages` (le français sert de modèle, les deux autres
 * langues doivent avoir exactement la même forme) puis les lit avec `useMessages` : changer de langue
 * dans les réglages met à jour tous les écrans immédiatement.
 */
export const LANGUAGES = ['mg', 'fr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Nom de chaque langue écrit dans cette langue (sélecteur des réglages). */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  mg: 'Malagasy',
  fr: 'Français',
  en: 'English',
};

const SETTING_KEY = 'app.language';

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Langue du téléphone si elle est proposée, sinon le français. */
function deviceLanguage(): Language {
  try {
    const code = getLocales()[0]?.languageCode ?? null;
    return isLanguage(code) ? code : 'fr';
  } catch {
    return 'fr';
  }
}

export const languageStore = createStore<Language>(deviceLanguage());

/** Textes d'un écran dans les trois langues ; `fr` fixe la forme que `mg` et `en` doivent respecter. */
export type Messages<T> = Readonly<Record<Language, T>>;

export function defineMessages<T>(fr: T, others: { readonly mg: T; readonly en: T }): Messages<T> {
  return { fr, mg: others.mg, en: others.en };
}

/** Langue courante (composant React : se met à jour au changement de langue). */
export function useLanguage(): Language {
  return useStore(languageStore);
}

/** Textes de l'écran dans la langue courante. */
export function useMessages<T>(messages: Messages<T>): T {
  return messages[useLanguage()];
}

/** Hors composant (services, notifications) : textes dans la langue courante. */
export function messagesOf<T>(messages: Messages<T>): T {
  return messages[languageStore.get()];
}

/** Lecture et enregistrement de la langue choisie (réglages SQLite). */
export const languageService = {
  /** À appeler une fois la base ouverte : applique la langue enregistrée. */
  async init(): Promise<void> {
    const stored = (await settingsRepository.getAll(SETTING_KEY)).get(SETTING_KEY);
    if (isLanguage(stored)) {
      languageStore.set(stored);
    }
  },

  async set(language: Language): Promise<void> {
    languageStore.set(language);
    await settingsRepository.set(SETTING_KEY, language);
  },
};
