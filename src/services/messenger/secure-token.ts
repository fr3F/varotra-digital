import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

const KEY = 'messenger.deviceToken';

/** Jeton d'accès au backend, conservé dans le stockage chiffré d'Android (Keystore). */
export const secureToken = {
  get: () => getItemAsync(KEY),
  set: (token: string) => setItemAsync(KEY, token),
  clear: () => deleteItemAsync(KEY),
};
