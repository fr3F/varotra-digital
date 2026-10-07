/** Boutique abonnée : une Page Facebook, ses téléphones et ses données. */
export interface Shop {
  readonly id: string;
  readonly name: string;
  /** Code remis au vendeur après paiement, saisi dans l'application. */
  readonly activationCode: string;
  readonly pageId: string | null;
  readonly pageName: string | null;
  /** Jeton de la Page (null : Page pas encore reliée). Ne quitte jamais le serveur. */
  readonly pageAccessToken: string | null;
  /** Fin de l'abonnement. */
  readonly expiresAt: string;
  /** Coupée par l'administrateur (impayé, abus…), quelle que soit la date de fin. */
  readonly suspendedAt: string | null;
  readonly createdAt: string;
}

/** Boutique créée avant le multi-boutique : reprend la Page configurée dans les secrets. */
export const DEFAULT_SHOP_ID = 'default';

/** Abonnement en cours et boutique non suspendue. */
export function isShopActive(shop: Shop, now: Date): boolean {
  return shop.suspendedAt === null && Date.parse(shop.expiresAt) > now.getTime();
}

/** Lettres et chiffres sans confusion possible (pas de 0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Code d'activation lisible, à dicter ou envoyer par SMS : « KD-7K2P-9XQ4 ». */
export function generateActivationCode(random: (max: number) => number): string {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[random(CODE_ALPHABET.length)]).join('');
  return `KD-${part()}-${part()}`;
}

/** Date de fin après ajout de `months` mois, à partir de maintenant ou de la fin actuelle si elle est future. */
export function extendedExpiry(currentExpiry: string | null, months: number, now: Date): string {
  const current = currentExpiry === null ? 0 : Date.parse(currentExpiry);
  const start = new Date(Math.max(current, now.getTime()));
  start.setUTCMonth(start.getUTCMonth() + months);
  return start.toISOString();
}
