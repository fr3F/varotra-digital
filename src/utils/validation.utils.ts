import { ValidationError } from '@/core/errors/app-error';

/** Texte obligatoire, nettoyé des espaces superflus. */
export function requireText(value: string, fieldLabel: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`Le champ « ${fieldLabel} » est obligatoire.`);
  }
  return trimmed;
}

/** Texte facultatif : une chaîne vide devient null. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Entier positif ou nul saisi par l'utilisateur ("12 500" accepté). Vide = defaultValue. */
export function parseNonNegativeInteger(value: string, fieldLabel: string, defaultValue = 0): number {
  const normalized = value.replace(/[\s ]/g, '');
  if (normalized.length === 0) {
    return defaultValue;
  }
  if (!/^\d+$/.test(normalized)) {
    throw new ValidationError(`Le champ « ${fieldLabel} » doit être un nombre entier positif.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new ValidationError(`Le champ « ${fieldLabel} » est trop grand.`);
  }
  return parsed;
}

/** Entier strictement positif. */
export function parsePositiveInteger(value: string, fieldLabel: string): number {
  const parsed = parseNonNegativeInteger(value, fieldLabel);
  if (parsed <= 0) {
    throw new ValidationError(`Le champ « ${fieldLabel} » doit être supérieur à zéro.`);
  }
  return parsed;
}
