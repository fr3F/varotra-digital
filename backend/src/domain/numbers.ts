/**
 * Nombres écrits en lettres (malgache, français, anglais), sur des mots déjà normalisés
 * (minuscules, sans accents ni ponctuation : « roa ambin'ny folo » → « roa ambin ny folo »).
 */

const UNITS: Readonly<Record<string, number>> = {
  // Malgache
  iray: 1, iraika: 1, roa: 2, telo: 3, efatra: 4, dimy: 5, enina: 6, fito: 7, valo: 8, sivy: 9,
  // Français
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  // Anglais
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9,
};

const TENS: Readonly<Record<string, number>> = {
  // Malgache : folo (10), roapolo (20)… zato (100)
  folo: 10, roapolo: 20, telopolo: 30, efapolo: 40, dimampolo: 50, enimpolo: 60, fitopolo: 70, valopolo: 80,
  sivifolo: 90, zato: 100,
  // Français
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30,
  quarante: 40, cinquante: 50, soixante: 60, cent: 100, douzaine: 12,
  // Anglais
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100, dozen: 12,
};

const DOZEN_WORDS = new Set(['douzaine', 'douzaines', 'dozen', 'dozens']);

function simpleValue(word: string | undefined): number | null {
  if (word === undefined) {
    return null;
  }
  if (word === 'six') {
    return 6;
  }
  return UNITS[word] ?? TENS[word] ?? null;
}

/**
 * Remplace les nombres en lettres par des chiffres :
 * « dimy ambin ny folo » → 15, « dimy amby roapolo » → 25, « vingt cinq » → 25, « twenty two » → 22.
 */
export function replaceNumberWords(words: readonly string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    const value = simpleValue(word);
    if (value === null) {
      result.push(word);
      continue;
    }
    // « une douzaine », « deux douzaines », « a dozen » : multiple de 12.
    if (value < 10 && DOZEN_WORDS.has(words[index + 1] ?? '')) {
      result.push(String(value * 12));
      index += 1;
      continue;
    }
    // Malgache : unité + « ambin ny folo » (11 à 19).
    if (value < 10 && words[index + 1] === 'ambin' && words[index + 2] === 'ny' && words[index + 3] === 'folo') {
      result.push(String(value + 10));
      index += 3;
      continue;
    }
    // Malgache : unité + « amby » + dizaine (« telo amby efapolo » = 43).
    const tens = simpleValue(words[index + 2]);
    if (value < 10 && words[index + 1] === 'amby' && tens !== null && tens >= 20) {
      result.push(String(value + tens));
      index += 2;
      continue;
    }
    // Français / anglais : dizaine suivie d'une unité (« vingt cinq », « twenty two »).
    const unit = simpleValue(words[index + 1]);
    if (value >= 20 && value < 100 && unit !== null && unit < 10) {
      result.push(String(value + unit));
      index += 1;
      continue;
    }
    result.push(String(value));
  }
  return result;
}

/** Message composé uniquement d'une quantité (« 3 », « roa », « twelve », « roa ambin'ny folo »), sinon null. */
export function quantityOnly(words: readonly string[]): number | null {
  const replaced = replaceNumberWords(words.filter((word) => word.length > 0));
  if (replaced.length !== 1) {
    return null;
  }
  const match = /^x?(\d{1,3})x?$/.exec(replaced[0] ?? '');
  return match?.[1] === undefined ? null : Number(match[1]);
}
