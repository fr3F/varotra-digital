import { settingsRepository } from '@/database/repositories/settings.repository';

const KEY = 'messenger.deviceToken';

/**
 * Web : pas de stockage chiffré équivalent au Keystore Android. Le jeton est gardé dans la base
 * locale du navigateur ; la version web sert au développement et aux démonstrations.
 */
export const secureToken = {
  async get(): Promise<string | null> {
    const value = (await settingsRepository.getAll(KEY)).get(KEY);
    return value === undefined || value.length === 0 ? null : value;
  },
  set: (token: string) => settingsRepository.set(KEY, token),
  clear: () => settingsRepository.set(KEY, ''),
};
