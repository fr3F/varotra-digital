import { createStore } from '@/core/state/store';
import { settingsRepository } from '@/database/repositories/settings.repository';

const PREFIX = 'onboarding.';
const DONE_KEY = `${PREFIX}done`;

/** null : pas encore lu ; true : guide déjà vu (il ne s'affiche plus jamais). */
export const onboardingStore = createStore<boolean | null>(null);

/** Guide du premier lancement : affiché une seule fois après l'installation. */
export const onboardingService = {
  async load(): Promise<void> {
    const stored = await settingsRepository.getAll(PREFIX);
    onboardingStore.set(stored.get(DONE_KEY) === '1');
  },

  async complete(): Promise<void> {
    await settingsRepository.set(DONE_KEY, '1');
    onboardingStore.set(true);
  },
};
