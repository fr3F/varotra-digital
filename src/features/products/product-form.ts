import { DEFAULT_STOCK_ALERT_THRESHOLD } from '@/core/constants/app.constants';
import { Product, ProductInput } from '@/models';
import {
  optionalText,
  parseNonNegativeInteger,
  requireText,
} from '@/utils/validation.utils';

/** Valeurs brutes du formulaire produit (tout est saisi en texte ; image vide = pas d'image). */
export type ProductFormValues = {
  readonly name: string;
  readonly sku: string;
  readonly category: string;
  readonly imageUri: string;
  readonly unitPrice: string;
  readonly costPrice: string;
  readonly alertThreshold: string;
  readonly initialStock: string;
  readonly description: string;
};

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: '',
  sku: '',
  category: '',
  imageUri: '',
  unitPrice: '',
  costPrice: '',
  alertThreshold: String(DEFAULT_STOCK_ALERT_THRESHOLD),
  initialStock: '',
  description: '',
};

export function productToFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku ?? '',
    category: product.category ?? '',
    imageUri: product.imageUri ?? '',
    unitPrice: String(product.unitPrice),
    costPrice: String(product.costPrice),
    alertThreshold: String(product.alertThreshold),
    initialStock: '',
    description: product.description ?? '',
  };
}

/** Valide et convertit la saisie. Lève une ValidationError au premier champ invalide. */
export function parseProductForm(values: ProductFormValues): { input: ProductInput; initialStock: number } {
  return {
    input: {
      name: requireText(values.name, 'Nom'),
      sku: optionalText(values.sku),
      category: optionalText(values.category),
      imageUri: optionalText(values.imageUri),
      description: optionalText(values.description),
      unitPrice: parseNonNegativeInteger(values.unitPrice, 'Prix de vente'),
      costPrice: parseNonNegativeInteger(values.costPrice, "Prix d'achat"),
      alertThreshold: parseNonNegativeInteger(values.alertThreshold, "Seuil d'alerte", DEFAULT_STOCK_ALERT_THRESHOLD),
    },
    initialStock: parseNonNegativeInteger(values.initialStock, 'Stock initial'),
  };
}
