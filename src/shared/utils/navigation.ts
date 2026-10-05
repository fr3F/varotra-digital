import { Href, router } from 'expo-router';

/**
 * Revient à l'écran précédent, ou ouvre `fallback` s'il n'y en a pas
 * (lien direct, page web rechargée).
 */
export function goBackOr(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
