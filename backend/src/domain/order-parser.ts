import { normalizeText } from '../shared/format.ts';
import type { CatalogProduct } from './types.ts';

export interface ParsedLine {
  readonly productId: string;
  readonly quantity: number;
  /** Morceau du message qui a servi à reconnaître le produit. */
  readonly segment: string;
}

export interface ParseResult {
  readonly lines: readonly ParsedLine[];
  /** Morceaux du message où aucun produit n'a été reconnu avec certitude. */
  readonly unmatched: readonly string[];
}

/** Nombres écrits en lettres, en français et en malgache. */
const NUMBER_WORDS: Readonly<Record<string, number>> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  iray: 1, roa: 2, telo: 3, efatra: 4, dimy: 5, enina: 6, fito: 7, valo: 8, sivy: 9, folo: 10,
};

/** Mots sans valeur pour reconnaître un produit (formules de politesse, verbes de commande…). */
const STOP_WORDS = new Set([
  'je', 'j', 'veux', 'voudrais', 'aimerais', 'commande', 'commander', 'acheter', 'prendre', 'svp', 'stp', 'merci',
  'bonjour', 'salut', 'de', 'des', 'du', 'la', 'le', 'les', 'l', 'd', 'avec', 'pour', 'moi', 's', 'il', 'vous', 'plait',
  'x', 'fois', 'piece', 'pieces', 'pcs', 'pc', 'unite', 'unites',
  'mila', 'aho', 'te', 'hividy', 'mba', 'azafady', 'misaotra', 'ny', 'ilay', 'manafatra', 'tompoko', 've', 'kely',
]);

/** Séparateurs entre deux articles : virgule, point-virgule, retour à la ligne, « + », « et », « sy ». */
const SEGMENT_SEPARATOR = /\s*(?:[,;\n+]|\bet\b|\bsy\b|\band\b)\s*/i;

const MAX_QUANTITY = 999;

function tokensOf(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((token) => token.length > 0);
}

/** Deux mots correspondent s'ils sont égaux, ou si l'un commence l'autre (« huil » / « huile »). */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 4 && longer.startsWith(shorter);
}

/** Lit « 2 », « x2 », « 2x », « deux », « roa ». */
function quantityOf(token: string): number | null {
  const digits = /^x?(\d{1,3})x?$/.exec(token);
  if (digits?.[1] !== undefined) {
    return Number(digits[1]);
  }
  return NUMBER_WORDS[token] ?? null;
}

interface ProductTokens {
  readonly product: CatalogProduct;
  readonly tokens: readonly string[];
  readonly sku: string | null;
}

function indexCatalog(catalog: readonly CatalogProduct[]): ProductTokens[] {
  return catalog.map((product) => ({
    product,
    tokens: tokensOf(product.name).filter((token) => !STOP_WORDS.has(token)),
    sku: product.sku === null ? null : normalizeText(product.sku).replace(/ /g, ''),
  }));
}

/**
 * Proportion des mots du nom du produit présents dans le morceau de message.
 * Il faut au moins un mot significatif en commun (3 lettres, ou contenant un chiffre comme « 1l »).
 */
function score(entry: ProductTokens, words: readonly string[]): { value: number; used: Set<string> } {
  const used = new Set<string>();
  if (entry.sku !== null && entry.sku.length >= 3 && words.includes(entry.sku)) {
    used.add(entry.sku);
    return { value: 1, used };
  }
  let matched = 0;
  let significant = false;
  entry.tokens.forEach((productToken) => {
    const word = words.find((candidate) => tokensMatch(candidate, productToken));
    if (word !== undefined) {
      matched += 1;
      used.add(word);
      significant ||= productToken.length >= 3 || /\d/.test(productToken);
    }
  });
  return { value: entry.tokens.length === 0 || !significant ? 0 : matched / entry.tokens.length, used };
}

function parseSegment(segment: string, catalog: readonly ProductTokens[]): ParsedLine | null {
  const words = tokensOf(segment).filter((token) => !STOP_WORDS.has(token));
  if (words.length === 0) {
    return null;
  }
  const ranked = catalog
    .map((entry) => ({ entry, ...score(entry, words) }))
    .filter((candidate) => candidate.value > 0)
    .sort((a, b) => b.value - a.value || b.used.size - a.used.size);
  const best = ranked[0];
  const second = ranked[1];
  if (best === undefined) {
    return null;
  }
  // Deux produits aussi plausibles l'un que l'autre : on laisse le client choisir dans le menu.
  if (second !== undefined && second.value === best.value && second.used.size === best.used.size) {
    return null;
  }
  // Correspondance partielle (« huile » pour « Huile Tiko 1L ») acceptée seulement si un seul produit correspond.
  if (best.value < 0.5 && second !== undefined) {
    return null;
  }
  // La quantité est un nombre qui ne fait pas partie du nom reconnu (« coca 1l 3 » -> 3).
  const quantity =
    words.filter((word) => !best.used.has(word)).map(quantityOf).find((value) => value !== null) ?? 1;
  return { productId: best.entry.product.id, quantity: Math.min(Math.max(quantity, 1), MAX_QUANTITY), segment };
}

/**
 * Transforme un message libre en lignes de commande, à partir du catalogue :
 * « Bonjour, je voudrais 2 huile tiko et un savon » -> [2 × Huile Tiko 1L, 1 × Savon Nosy].
 * Un même produit cité plusieurs fois est regroupé.
 */
export function parseOrderMessage(text: string, catalog: readonly CatalogProduct[]): ParseResult {
  const index = indexCatalog(catalog);
  const totals = new Map<string, ParsedLine>();
  const unmatched: string[] = [];

  text
    .split(SEGMENT_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .forEach((segment) => {
      const line = parseSegment(segment, index);
      if (line === null) {
        // Un morceau sans mot utile (« merci ») n'est pas signalé comme incompris.
        if (tokensOf(segment).some((token) => !STOP_WORDS.has(token))) {
          unmatched.push(segment);
        }
        return;
      }
      const existing = totals.get(line.productId);
      totals.set(
        line.productId,
        existing === undefined ? line : { ...existing, quantity: Math.min(existing.quantity + line.quantity, MAX_QUANTITY) },
      );
    });

  return { lines: [...totals.values()], unmatched };
}
