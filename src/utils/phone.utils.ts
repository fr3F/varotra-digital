import { ValidationError } from '@/core/errors/app-error';

/** Chiffres du numéro (et « + » initial) : sert aux comparaisons et à la recherche. */
export function phoneDigits(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Deux numéros désignent la même ligne : 034 12 345 67 et +261 34 12 345 67 sont équivalents
 * (on compare les 9 derniers chiffres, longueur d'un numéro malgache sans indicatif).
 */
export function isSamePhone(a: string, b: string): boolean {
  const left = a.replace(/\D/g, '');
  const right = b.replace(/\D/g, '');
  if (left.length < 6 || right.length < 6) {
    return left === right;
  }
  return left.slice(-9) === right.slice(-9);
}

/** Téléphone facultatif : vide = null ; sinon chiffres, espaces, +, -, (, ), . et 6 à 15 chiffres. */
export function parseOptionalPhone(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    return null;
  }
  const digitCount = trimmed.replace(/\D/g, '').length;
  if (!/^\+?[\d\s().-]+$/.test(trimmed) || digitCount < 6 || digitCount > 15) {
    throw new ValidationError('Numéro de téléphone invalide (ex. 034 12 345 67 ou +261 34 12 345 67).');
  }
  return trimmed;
}
