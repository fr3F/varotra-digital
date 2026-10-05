import { ValidationError } from '@/core/errors/app-error';
import { EntityId, Money } from '@/models';

/** Ligne produit commune aux commandes et aux ventes. */
export interface ProductLine {
  readonly productId: EntityId;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export function computeLineTotal(quantity: number, unitPrice: Money): Money {
  return quantity * unitPrice;
}

export function computeLinesTotal(lines: readonly ProductLine[]): Money {
  return lines.reduce((total, line) => total + computeLineTotal(line.quantity, line.unitPrice), 0);
}

/** Vérifie la saisie : au moins une ligne, quantités et prix valides, pas de produit en double. */
export function validateProductLines<T extends ProductLine>(
  lines: readonly T[],
  options: { readonly allowEmpty?: boolean } = {},
): readonly T[] {
  if (lines.length === 0 && options.allowEmpty !== true) {
    throw new ValidationError('Ajoutez au moins un produit.');
  }
  const seen = new Set<EntityId>();
  lines.forEach((line) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new ValidationError('Chaque quantité doit être un entier supérieur à zéro.');
    }
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new ValidationError('Chaque prix doit être un entier positif ou nul.');
    }
    if (!Number.isSafeInteger(computeLineTotal(line.quantity, line.unitPrice))) {
      throw new ValidationError('Le montant d’une ligne est trop élevé.');
    }
    if (seen.has(line.productId)) {
      throw new ValidationError('Un même produit apparaît sur plusieurs lignes : regroupez-les.');
    }
    seen.add(line.productId);
  });
  return lines;
}

/** Préfixe de référence du jour : CMD-20261002- / VTE-20261002-. */
export function referencePrefix(kind: 'CMD' | 'VTE', date: Date): string {
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${kind}-${day}-`;
}
