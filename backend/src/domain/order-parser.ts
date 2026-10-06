import { normalizeText } from '../shared/format.ts';
import { replaceNumberWords } from './numbers.ts';
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

/** Mots sans valeur pour reconnaître un produit (politesse, verbes de commande…), en français, malgache et anglais. */
const STOP_WORDS = new Set([
  // Français
  'je', 'j', 'veux', 'voudrais', 'aimerais', 'commande', 'commander', 'acheter', 'prendre', 'svp', 'stp', 'merci',
  'bonjour', 'bonsoir', 'salut', 'de', 'des', 'du', 'la', 'le', 'les', 'l', 'd', 'avec', 'pour', 'moi', 's', 'il',
  'vous', 'plait', 'x', 'fois', 'piece', 'pieces', 'pcs', 'pc', 'unite', 'unites', 'besoin', 'ai', 'faut', 'me',
  'donnez', 'envoyez', 'aussi', 'encore',
  // Malgache
  'mila', 'aho', 'te', 'hividy', 'mba', 'azafady', 'misaotra', 'ny', 'ilay', 'manafatra', 'tompoko', 've', 'kely',
  'omeo', 'alefaso', 'ahy', 'hoe', 'izaho', 'ilaiko', 'tiako', 'ho', 'an', 're', 'ry', 'dia', 'koa', 'salama',
  'manao', 'ahoana', 'vidiana', 'hafa', 'raha', 'sombiny',
  // Anglais
  'i', 'want', 'need', 'would', 'like', 'please', 'pls', 'buy', 'order', 'some', 'give', 'get', 'can', 'have',
  'the', 'a', 'of', 'hello', 'hi', 'thanks', 'thank', 'you', 'also', 'more', 'units',
]);

/** Séparateurs entre deux articles : virgule, point-virgule, retour à la ligne, « + », « & », « et », « sy », « ary », « and ». */
const SEGMENT_SEPARATOR = /\s*(?:[,;\n+&]|\bet\b|\bsy\b|\bary\b|\band\b)\s*/i;

const MAX_QUANTITY = 999;

/** Mots normalisés, nombres en lettres convertis en chiffres (« roa ambin'ny folo » → « 12 »). */
function tokensOf(text: string): string[] {
  return replaceNumberWords(
    normalizeText(text)
      .split(' ')
      .filter((token) => token.length > 0),
  );
}

/** Distance d'édition (insertion, suppression, substitution) entre deux mots courts. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

/**
 * Deux mots correspondent s'ils sont égaux, si l'un commence l'autre (« huil » / « huile »),
 * ou à une faute de frappe près (« kirarro » / « kiraro » ; deux fautes à partir de 8 lettres).
 */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 4 && longer.startsWith(shorter)) {
    return true;
  }
  if (/\d/.test(a) || /\d/.test(b) || shorter.length < 5) {
    return false;
  }
  return editDistance(a, b) <= (shorter.length >= 8 ? 2 : 1);
}

/** Nom attaché (« tshirt ») : égalité ou faute de frappe, jamais un simple début (« coca » ≠ « cocacola33cl »). */
function compactMatch(word: string, compact: string): boolean {
  if (word.length < 5) {
    return false;
  }
  return word === compact || (!/\d/.test(compact) && editDistance(word, compact) <= (compact.length >= 8 ? 2 : 1));
}

/** Lit « 2 », « x2 », « 2x » (les nombres en lettres sont déjà convertis par tokensOf). */
function quantityOf(token: string): number | null {
  const digits = /^x?(\d{1,3})x?$/.exec(token);
  return digits?.[1] === undefined ? null : Number(digits[1]);
}

interface ProductTokens {
  readonly product: CatalogProduct;
  readonly tokens: readonly string[];
  readonly sku: string | null;
  /** Nom en un seul mot (« T-shirt » → « tshirt ») : le client l'écrit souvent attaché. */
  readonly compact: string | null;
}

function indexCatalog(catalog: readonly CatalogProduct[]): ProductTokens[] {
  return catalog.map((product) => ({
    product,
    tokens: tokensOf(product.name).filter((token) => !STOP_WORDS.has(token)),
    sku: product.sku === null ? null : normalizeText(product.sku).replace(/ /g, ''),
    compact: normalizeText(product.name).includes(' ') ? normalizeText(product.name).replace(/ /g, '') : null,
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
  const compactWord = entry.compact === null ? undefined : words.find((word) => compactMatch(word, entry.compact ?? ''));
  if (compactWord !== undefined) {
    used.add(compactWord);
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
