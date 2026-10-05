import { EntityId, Money, Product } from '@/models';
import { parseNonNegativeInteger, parsePositiveInteger } from '@/utils/validation.utils';

/** Ligne produit telle que saisie (texte libre, validée à l'enregistrement). Commandes et ventes. */
export interface ProductLineFormValue {
  readonly productId: EntityId;
  readonly quantity: string;
  readonly unitPrice: string;
}

export interface ParsedProductLine {
  readonly productId: EntityId;
  readonly quantity: number;
  readonly unitPrice: Money;
}

/** Ajoute le produit au prix catalogue, ou augmente sa quantité s'il est déjà présent. */
export function addProductLine(lines: readonly ProductLineFormValue[], product: Product): ProductLineFormValue[] {
  const existing = lines.find((line) => line.productId === product.id);
  if (existing === undefined) {
    return [...lines, { productId: product.id, quantity: '1', unitPrice: String(product.unitPrice) }];
  }
  return lines.map((line) =>
    line.productId === product.id ? { ...line, quantity: String((parseQuantity(line.quantity) ?? 0) + 1) } : line,
  );
}

/** Quantité saisie si elle est valide, sinon null (pour les aperçus). */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? Number(trimmed) : null;
}

export function parsePrice(text: string): Money | null {
  const normalized = text.replace(/[\s ]/g, '');
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

/** Montant de la ligne, ou null si la saisie est incomplète. */
export function previewLineTotal(line: ProductLineFormValue): Money | null {
  const quantity = parseQuantity(line.quantity);
  const price = parsePrice(line.unitPrice);
  return quantity === null || price === null ? null : quantity * price;
}

/** Total des lignes valides (aperçu en direct). */
export function previewLinesTotal(lines: readonly ProductLineFormValue[]): Money {
  return lines.reduce((total, line) => total + (previewLineTotal(line) ?? 0), 0);
}

/** Coût d'achat des lignes valides, au prix d'achat actuel des produits (aperçu du bénéfice). */
export function previewLinesCost(lines: readonly ProductLineFormValue[], products: readonly Product[]): Money {
  return lines.reduce((total, line) => {
    const quantity = parseQuantity(line.quantity);
    const product = products.find((candidate) => candidate.id === line.productId);
    return quantity === null || product === undefined ? total : total + quantity * product.costPrice;
  }, 0);
}

/** Valide les lignes ; `nameOf` nomme le produit fautif dans le message d'erreur. */
export function parseProductLines(
  lines: readonly ProductLineFormValue[],
  nameOf: (productId: EntityId) => string,
): ParsedProductLine[] {
  return lines.map((line) => {
    const name = nameOf(line.productId);
    return {
      productId: line.productId,
      quantity: parsePositiveInteger(line.quantity, `Quantité de ${name}`),
      unitPrice: parseNonNegativeInteger(line.unitPrice, `Prix de ${name}`),
    };
  });
}
