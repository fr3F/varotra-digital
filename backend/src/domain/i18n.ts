import { normalizeText } from '../shared/format.ts';

/**
 * Langues du bot : malgache, français, anglais. La langue est détectée sur chaque message écrit
 * et conservée dans la conversation ; dans une autre langue, le bot comprend toujours les chiffres
 * et les noms de produits, et répond dans la dernière langue reconnue.
 */
export const LANGS = ['mg', 'fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'fr';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** Mots typiques de chaque langue (sans accents, en minuscules). */
const LANGUAGE_WORDS: Readonly<Record<Lang, ReadonlySet<string>>> = {
  mg: new Set([
    'mila', 'aho', 'azafady', 'misaotra', 'manao', 'ahoana', 'salama', 'sy', 'ary', 'iray', 'iraika', 'roa', 'telo',
    'efatra', 'dimy', 'enina', 'fito', 'valo', 'sivy', 'folo', 'te', 'hividy', 've', 'ny', 'ilay', 'entana', 'vidiny',
    'omeo', 'alefaso', 'firy', 'tompoko', 'eny', 'tsia', 'ahy', 'kaomandy', 'inona', 'misy', 'tsy', 'aiza', 'mbola',
    'hoe', 'izaho', 'ianao', 'ilaiko', 'tiako', 'amby', 'ambin', 'zato', 'akory', 'veloma', 'mba', 're', 'ilainy',
  ]),
  fr: new Set([
    'je', 'veux', 'voudrais', 'bonjour', 'bonsoir', 'svp', 'merci', 'et', 'des', 'le', 'la', 'les', 'commande',
    'acheter', 'combien', 'oui', 'non', 'prix', 'une', 'deux', 'trois', 'quatre', 'cinq', 'salut', 'mon', 'ma',
    'avec', 'pour', 'est', 'besoin', 'aimerais', 'plait', 'stp', 'du', 'moi', 'donnez', 'envoyez', 'livraison',
  ]),
  en: new Set([
    'i', 'want', 'need', 'would', 'like', 'please', 'buy', 'order', 'hello', 'hi', 'the', 'and', 'some', 'can',
    'you', 'have', 'how', 'much', 'thanks', 'thank', 'yes', 'my', 'get', 'give', 'me', 'price', 'products', 'one',
    'two', 'three', 'four', 'five', 'pieces', 'pcs', 'pls', 'delivery', 'where', 'is', 'of', 'many',
  ]),
};

/** Langue la plus probable d'un message, ou null si rien n'est reconnu (garder la langue précédente). */
export function detectLanguage(text: string): Lang | null {
  const words = normalizeText(text).split(' ');
  const scores = LANGS.map((lang) => ({ lang, score: words.filter((word) => LANGUAGE_WORDS[lang].has(word)).length }));
  scores.sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  return best === undefined || best.score === 0 || best.score === second?.score ? null : best.lang;
}

/** Tous les textes envoyés aux clients, par langue. */
export interface Messages {
  readonly buttons: {
    readonly checkout: string;
    readonly adjust: string;
    readonly more: string;
    readonly cancel: string;
    readonly menu: string;
    readonly sendRaw: string;
    readonly next: string;
    readonly cart: (count: number) => string;
    readonly newOrder: string;
  };
  readonly welcome: (customerName: string | null) => string;
  readonly productsHeader: (page: number, pageCount: number) => string;
  readonly noProducts: string;
  readonly productUnavailable: string;
  readonly emptyCart: string;
  readonly cartTitle: string;
  /** « Total : 24 000 Ar » (typographie de chaque langue). */
  readonly total: (amount: string) => string;
  readonly onlyInStock: (available: number) => string;
  readonly soldOut: string;
  readonly stockShortage: string;
  readonly adjusted: string;
  readonly allSoldOut: string;
  readonly cannotValidate: string;
  readonly noted: (quantity: number, productName: string) => string;
  /** `details` : description, ⭐, 🔥… affichés entre le prix et la question. */
  readonly howMany: (productName: string, price: string, details: readonly string[]) => string;
  readonly cartCleared: string;
  readonly notRecognized: (parts: readonly string[]) => string;
  readonly notUnderstood: string;
  readonly textOnly: string;
  /** Consigne sous les choix numérotés (Facebook Lite n'affiche pas les boutons). */
  readonly chooseByNumber: string;
  /** Livraison : coordonnées demandées après « Valider », avant d'enregistrer la commande. */
  readonly askPhone: string;
  readonly invalidPhone: string;
  readonly askAddress: string;
  readonly invalidAddress: string;
  readonly deliveryContact: (phone: string, address: string) => string;
  readonly deliveryFee: (fee: string) => string;
  readonly deliveryToDiscuss: string;
  /** Frais convenus ensuite par le vendeur (commande hors Antananarivo). */
  readonly deliveryFeeSet: (reference: string, fee: string, total: string) => string;
  readonly receipt: (reference: string, lines: string, total: string) => string;
  readonly rawSent: (reference: string) => string;
  readonly reference: string;
  readonly confirmed: string;
  readonly unavailable: string;
  readonly unavailableLine: (productName: string, available: number, requested: number) => string;
  readonly soldOutLine: (productName: string) => string;
  readonly unavailableFooter: (reference: string) => string;
  readonly preparing: (reference: string) => string;
  readonly delivered: (reference: string) => string;
  readonly cancelled: (reference: string) => string;
  readonly statusLabels: Readonly<Record<'RECEIVED' | 'CONFIRMED' | 'UNAVAILABLE' | 'PREPARING' | 'DELIVERED' | 'CANCELLED', string>>;
  readonly statusInquiry: (reference: string, total: string, label: string) => string;
  /** Vente : badges et arguments, toujours fondés sur des données réelles (ventes, stock, description). */
  readonly sales: {
    readonly lowStockTag: (available: number) => string;
    readonly legend: string;
    readonly popularLine: string;
    readonly lowStockLine: (available: number) => string;
    readonly suggestion: (names: string) => string;
    readonly nudge: string;
    readonly cartWaiting: string;
  };
  /** Réponses aux questions, client fidèle, remerciements. */
  readonly smart: {
    readonly inStock: string;
    readonly soldOutNow: string;
    readonly askQuantity: string;
    readonly soldOutAlternatives: string;
    readonly buy: (productName: string) => string;
    readonly welcomeBack: (customerName: string | null) => string;
    readonly reorder: string;
    readonly reorderIntro: string;
    readonly noPreviousOrder: string;
    readonly thanks: string;
  };
}

export const MESSAGES: Readonly<Record<Lang, Messages>> = {
  fr: {
    buttons: {
      checkout: '✅ Valider',
      adjust: '✔️ Ajuster au stock',
      more: '➕ Autre produit',
      cancel: '🗑️ Annuler',
      menu: '🛒 Voir les produits',
      sendRaw: '📝 Envoyer au vendeur',
      next: 'Suite ▶',
      cart: (count) => `🛒 Panier (${count})`,
      newOrder: '🛒 Nouvelle commande',
    },
    welcome: (name) =>
      `${name === null ? 'Bonjour 👋' : `Bonjour ${name} 👋`} Bienvenue !\nCommandez ici en 1 minute : choisissez un produit ci-dessous, ou écrivez simplement votre commande, par exemple « 2 huile tiko et 1 savon ».`,
    productsHeader: (page, count) => (count > 1 ? `Nos produits (${page}/${count}) :` : 'Nos produits :'),
    noProducts: 'Aucun produit n’est disponible pour le moment. Écrivez votre demande : le vendeur vous répondra.',
    productUnavailable: 'Désolé, ce produit n’est plus disponible.',
    emptyCart: 'Votre panier est vide.',
    cartTitle: 'Votre panier :',
    total: (amount) => `Total : ${amount}`,
    onlyInStock: (available) => `⚠️ seulement ${available} en stock`,
    soldOut: '⚠️ épuisé',
    stockShortage: '⚠️ Stock insuffisant : ajustez votre panier pour pouvoir le valider.',
    adjusted: 'Panier ajusté au stock disponible 👍',
    allSoldOut: 'Désolé, ces produits sont épuisés pour le moment.',
    cannotValidate: 'Impossible de valider : stock insuffisant.',
    noted: (quantity, name) => `C’est noté : ${quantity} × ${name}.`,
    howMany: (name, price, details) => `${name} — ${price}${details.map((line) => `\n${line}`).join('')}\nCombien en voulez-vous ? (ou écrivez un nombre)`,
    cartCleared: 'Votre panier a été vidé. Écrivez « menu » pour recommencer.',
    notRecognized: (parts) => `Je n’ai pas reconnu : « ${parts.join(' », « ')} ».`,
    notUnderstood: 'Je n’ai pas bien compris 🙏 Choisissez un produit dans la liste, ou envoyez votre message tel quel au vendeur.',
    askPhone: 'Parfait ! Pour la livraison, quel est votre numéro de téléphone ? 📞 (ex. : 034 12 345 67)',
    invalidPhone: 'Je n’ai pas reconnu ce numéro 🙏 Écrivez-le comme ceci : 034 12 345 67',
    askAddress: 'Merci ! Où faut-il livrer ? 📍 Écrivez l’adresse complète (quartier, ville).',
    invalidAddress: 'Écrivez l’adresse de livraison (quartier, ville) 📍',
    deliveryContact: (phone, address) => `📞 ${phone}\n📍 ${address}`,
    deliveryFee: (fee) => `🚚 Livraison (Antananarivo) : ${fee}`,
    deliveryToDiscuss: '🚚 Livraison hors d’Antananarivo : le responsable vous appellera pour convenir des frais.',
    deliveryFeeSet: (reference, fee, total) => `🚚 Frais de livraison (commande ${reference}) : ${fee}\nTotal à payer : ${total}`,
    chooseByNumber: '✍️ Répondez avec le numéro (ex. : 1)',
    textOnly: 'Je ne peux lire que les messages écrits pour le moment. Écrivez votre commande 🙂',
    receipt: (reference, lines, total) =>
      `Commande reçue ✅ (réf. ${reference})\n${lines}\nTotal : ${total}\nLe vendeur vous confirmera la disponibilité et la livraison.`,
    rawSent: (reference) => `Merci ! Votre message a été transmis au vendeur (réf. ${reference}). Il vous répondra très vite.`,
    reference: 'Réf.',
    confirmed: 'Votre commande est confirmée.',
    unavailable: 'Produit indisponible actuellement.',
    unavailableLine: (name, available, requested) => `• ${name} : ${available} disponible(s) sur ${requested} demandé(s)`,
    soldOutLine: (name) => `• ${name} : épuisé`,
    unavailableFooter: (reference) => `Réf. ${reference} — nous vous recontactons dès que possible.`,
    preparing: (reference) => `Votre commande ${reference} est en préparation 📦`,
    delivered: (reference) => `Votre commande ${reference} a été livrée. Merci pour votre confiance 🙏`,
    cancelled: (reference) => `Votre commande ${reference} a été annulée. N’hésitez pas à nous écrire pour toute question.`,
    statusLabels: {
      RECEIVED: 'reçue, en attente de confirmation par le vendeur',
      CONFIRMED: 'confirmée ✅',
      UNAVAILABLE: 'en attente : un produit est indisponible actuellement',
      PREPARING: 'en préparation 📦',
      DELIVERED: 'livrée',
      CANCELLED: 'annulée',
    },
    statusInquiry: (reference, total, label) => `Votre commande ${reference} (${total}) est ${label}.`,
    sales: {
      lowStockTag: (available) => `🔥 plus que ${available}`,
      legend: '⭐ = les plus demandés',
      popularLine: '⭐ Très demandé en ce moment',
      lowStockLine: (available) => `🔥 Plus que ${available} en stock`,
      suggestion: (names) => `💡 Souvent pris avec : ${names}`,
      nudge: '👉 Validez maintenant : le vendeur prépare votre commande dès confirmation.',
      cartWaiting: 'Votre panier vous attend 🛒 Il ne reste qu’à valider !',
    },
    smart: {
      inStock: '✅ Disponible',
      soldOutNow: '😔 Épuisé pour le moment',
      askQuantity: 'Combien en voulez-vous ? (ou écrivez un nombre)',
      soldOutAlternatives: 'Voici ce qui est disponible :',
      buy: (name) => `🛒 ${name}`,
      welcomeBack: (name) => `Ravi de vous revoir${name === null ? '' : ` ${name}`} 👋`,
      reorder: '🔁 Comme avant',
      reorderIntro: 'Votre dernière commande, prête à être validée 🔁',
      noPreviousOrder: 'Vous n’avez pas encore commandé ici.',
      thanks: 'Merci à vous 🙏 Écrivez-nous quand vous voulez, nous sommes là !',
    },
  },

  mg: {
    buttons: {
      checkout: '✅ Hamafisina',
      adjust: '✔️ Araka ny tahiry',
      more: '➕ Entana hafa',
      cancel: '🗑️ Foanana',
      menu: '🛒 Hijery entana',
      sendRaw: '📝 Alefaso',
      next: 'Manaraka ▶',
      cart: (count) => `🛒 Harona (${count})`,
      newOrder: '🛒 Kaomandy vaovao',
    },
    welcome: (name) =>
      `${name === null ? 'Manao ahoana 👋' : `Manao ahoana ${name} 👋`} Tongasoa !\nMora sy haingana ny manafatra eto : safidio eto ambany ny entana tianao, na soraty fotsiny ny kaomandinao, ohatra « Mila huile tiko 2 sy savon 1 ».`,
    productsHeader: (page, count) => (count > 1 ? `Ny entanay (${page}/${count}) :` : 'Ny entanay :'),
    noProducts: 'Tsy misy entana azo vidiana amin’izao fotoana izao. Soraty ny filanao fa hamaly anao ny mpivarotra.',
    productUnavailable: 'Miala tsiny, tsy misy intsony io entana io.',
    emptyCart: 'Foana ny haronao.',
    cartTitle: 'Ny haronao :',
    total: (amount) => `Totaly : ${amount}`,
    onlyInStock: (available) => `⚠️ ${available} sisa no misy`,
    soldOut: '⚠️ lany',
    stockShortage: '⚠️ Tsy ampy ny tahiry : ahitsio ny haronao vao azo hamafisina.',
    adjusted: 'Nahitsy araka ny tahiry misy ny haronao 👍',
    allSoldOut: 'Miala tsiny, lany daholo ireo entana ireo amin’izao.',
    cannotValidate: 'Tsy azo hamafisina : tsy ampy ny tahiry.',
    noted: (quantity, name) => `Voaray : ${quantity} × ${name}.`,
    howMany: (name, price, details) => `${name} — ${price}${details.map((line) => `\n${line}`).join('')}\nFiry no ilainao ? (na soraty ny isa)`,
    cartCleared: 'Voafafa ny haronao. Soraty hoe « menu » raha hanomboka indray.',
    notRecognized: (parts) => `Tsy fantatro : « ${parts.join(' », « ')} ».`,
    notUnderstood: 'Tsy azoko tsara 🙏 Mifidiana entana ao amin’ny lisitra, na alefaso amin’ny mpivarotra ny hafatrao.',
    askPhone: 'Tsara! Ho an’ny fanaterana, inona ny laharana findainao? 📞 (ohatra: 034 12 345 67)',
    invalidPhone: 'Tsy fantatro io laharana io 🙏 Soraty toy izao azafady: 034 12 345 67',
    askAddress: 'Misaotra! Aiza no hanaterana azy? 📍 Soraty ny adiresy feno (fokontany, tanàna).',
    invalidAddress: 'Soraty ny adiresy hanaterana azy (fokontany, tanàna) 📍',
    deliveryContact: (phone, address) => `📞 ${phone}\n📍 ${address}`,
    deliveryFee: (fee) => `🚚 Saran’ny fanaterana (Antananarivo): ${fee}`,
    deliveryToDiscuss: '🚚 Fanaterana ivelan’i Antananarivo: hiantso anao ny tompon’andraikitra mba hiresahana ny saran’ny fanaterana.',
    deliveryFeeSet: (reference, fee, total) => `🚚 Saran’ny fanaterana (kaomandy ${reference}): ${fee}\nTotaly aloa: ${total}`,
    chooseByNumber: '✍️ Valio amin’ny laharana (ohatra: 1)',
    textOnly: 'Hafatra an-tsoratra ihany no vakiako amin’izao. Soraty ny kaomandinao 🙂',
    receipt: (reference, lines, total) =>
      `Voaray ny kaomandinao ✅ (laharana ${reference})\n${lines}\nTotaly : ${total}\nHanamafy aminao ny fisian’ny entana sy ny fanaterana ny mpivarotra.`,
    rawSent: (reference) => `Misaotra ! Tonga any amin’ny mpivarotra ny hafatrao (laharana ${reference}). Hamaly anao tsy ho ela izy.`,
    reference: 'Laharana',
    confirmed: 'Voamafy ny kaomandinao.',
    unavailable: 'Tsy misy amin’izao ny entana.',
    unavailableLine: (name, available, requested) => `• ${name} : ${available} no misy amin’ny ${requested} nangatahina`,
    soldOutLine: (name) => `• ${name} : lany`,
    unavailableFooter: (reference) => `Laharana ${reference} — hiverina aminao izahay raha vao azo atao.`,
    preparing: (reference) => `Eo am-panomanana ny kaomandinao ${reference} 📦`,
    delivered: (reference) => `Tonga any aminao ny kaomandinao ${reference}. Misaotra tamin’ny fitokisanao 🙏`,
    cancelled: (reference) => `Nofoanana ny kaomandinao ${reference}. Aza misalasala manoratra aminay raha misy fanontaniana.`,
    statusLabels: {
      RECEIVED: 'voaray, miandry ny fanamafisan’ny mpivarotra',
      CONFIRMED: 'voamafy ✅',
      UNAVAILABLE: 'miandry : tsy misy amin’izao ny entana iray',
      PREPARING: 'eo am-panomanana 📦',
      DELIVERED: 'tonga',
      CANCELLED: 'nofoanana',
    },
    statusInquiry: (reference, total, label) => `Ny kaomandinao ${reference} (${total}) : ${label}.`,
    sales: {
      lowStockTag: (available) => `🔥 ${available} sisa`,
      legend: '⭐ = be mpividy indrindra',
      popularLine: '⭐ Be mpividy amin’izao',
      lowStockLine: (available) => `🔥 ${available} sisa no misy`,
      suggestion: (names) => `💡 Matetika miaraka amin’ny : ${names}`,
      nudge: '👉 Hamafiso izao dia hanomana ny kaomandinao avy hatrany ny mpivarotra.',
      cartWaiting: 'Mbola miandry anao ny haronao 🛒 Hamafiso fotsiny dia vita !',
    },
    smart: {
      inStock: '✅ Misy',
      soldOutNow: '😔 Lany amin’izao',
      askQuantity: 'Firy no ilainao ? (na soraty ny isa)',
      soldOutAlternatives: 'Ireto kosa no misy :',
      buy: (name) => `🛒 ${name}`,
      welcomeBack: (name) => `Faly mahita anao indray${name === null ? '' : ` ${name}`} 👋`,
      reorder: '🔁 Toy ny teo',
      reorderIntro: 'Ity ny kaomandinao farany, vonona hamafisina 🔁',
      noPreviousOrder: 'Mbola tsy nanafatra teto ianao.',
      thanks: 'Misaotra anao koa 🙏 Eto foana izahay raha mila zavatra ianao !',
    },
  },

  en: {
    buttons: {
      checkout: '✅ Confirm',
      adjust: '✔️ Adjust to stock',
      more: '➕ Other product',
      cancel: '🗑️ Cancel',
      menu: '🛒 See products',
      sendRaw: '📝 Send to seller',
      next: 'Next ▶',
      cart: (count) => `🛒 Cart (${count})`,
      newOrder: '🛒 New order',
    },
    welcome: (name) =>
      `${name === null ? 'Hello 👋' : `Hello ${name} 👋`} Welcome!\nOrder here in 1 minute: pick a product below, or simply type your order, for example “2 huile tiko and 1 savon”.`,
    productsHeader: (page, count) => (count > 1 ? `Our products (${page}/${count}):` : 'Our products:'),
    noProducts: 'No products are available right now. Write your request and the seller will reply.',
    productUnavailable: 'Sorry, this product is no longer available.',
    emptyCart: 'Your cart is empty.',
    cartTitle: 'Your cart:',
    total: (amount) => `Total: ${amount}`,
    onlyInStock: (available) => `⚠️ only ${available} in stock`,
    soldOut: '⚠️ sold out',
    stockShortage: '⚠️ Not enough stock: adjust your cart to confirm it.',
    adjusted: 'Cart adjusted to the available stock 👍',
    allSoldOut: 'Sorry, these products are sold out for now.',
    cannotValidate: 'Cannot confirm: not enough stock.',
    noted: (quantity, name) => `Noted: ${quantity} × ${name}.`,
    howMany: (name, price, details) => `${name} — ${price}${details.map((line) => `\n${line}`).join('')}\nHow many would you like? (or type a number)`,
    cartCleared: 'Your cart has been emptied. Type “menu” to start again.',
    notRecognized: (parts) => `I didn’t recognize: “${parts.join('”, “')}”.`,
    notUnderstood: 'Sorry, I didn’t understand 🙏 Pick a product from the list, or send your message as is to the seller.',
    askPhone: 'Great! For delivery, what is your phone number? 📞 (e.g. 034 12 345 67)',
    invalidPhone: 'I didn’t recognise that number 🙏 Please write it like this: 034 12 345 67',
    askAddress: 'Thanks! Where should we deliver? 📍 Write the full address (area, town).',
    invalidAddress: 'Please write the delivery address (area, town) 📍',
    deliveryContact: (phone, address) => `📞 ${phone}\n📍 ${address}`,
    deliveryFee: (fee) => `🚚 Delivery (Antananarivo): ${fee}`,
    deliveryToDiscuss: '🚚 Delivery outside Antananarivo: the manager will call you to agree on the fee.',
    deliveryFeeSet: (reference, fee, total) => `🚚 Delivery fee (order ${reference}): ${fee}\nTotal to pay: ${total}`,
    chooseByNumber: '✍️ Reply with the number (e.g. 1)',
    textOnly: 'I can only read text messages for now. Please type your order 🙂',
    receipt: (reference, lines, total) =>
      `Order received ✅ (ref. ${reference})\n${lines}\nTotal: ${total}\nThe seller will confirm availability and delivery.`,
    rawSent: (reference) => `Thank you! Your message was sent to the seller (ref. ${reference}). They will reply soon.`,
    reference: 'Ref.',
    confirmed: 'Your order is confirmed.',
    unavailable: 'Product currently unavailable.',
    unavailableLine: (name, available, requested) => `• ${name}: ${available} available out of ${requested} requested`,
    soldOutLine: (name) => `• ${name}: sold out`,
    unavailableFooter: (reference) => `Ref. ${reference} — we will get back to you as soon as possible.`,
    preparing: (reference) => `Your order ${reference} is being prepared 📦`,
    delivered: (reference) => `Your order ${reference} has been delivered. Thank you for your trust 🙏`,
    cancelled: (reference) => `Your order ${reference} has been cancelled. Feel free to write to us with any question.`,
    statusLabels: {
      RECEIVED: 'received, waiting for the seller’s confirmation',
      CONFIRMED: 'confirmed ✅',
      UNAVAILABLE: 'on hold: a product is currently unavailable',
      PREPARING: 'being prepared 📦',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
    },
    statusInquiry: (reference, total, label) => `Your order ${reference} (${total}) is ${label}.`,
    sales: {
      lowStockTag: (available) => `🔥 only ${available} left`,
      legend: '⭐ = best sellers',
      popularLine: '⭐ Popular right now',
      lowStockLine: (available) => `🔥 Only ${available} left in stock`,
      suggestion: (names) => `💡 Often bought with: ${names}`,
      nudge: '👉 Confirm now and the seller will prepare your order right away.',
      cartWaiting: 'Your cart is waiting 🛒 Just confirm it and you’re done!',
    },
    smart: {
      inStock: '✅ In stock',
      soldOutNow: '😔 Sold out for now',
      askQuantity: 'How many would you like? (or type a number)',
      soldOutAlternatives: 'Here is what is available:',
      buy: (name) => `🛒 ${name}`,
      welcomeBack: (name) => `Great to see you again${name === null ? '' : ` ${name}`} 👋`,
      reorder: '🔁 Same again',
      reorderIntro: 'Your last order, ready to confirm 🔁',
      noPreviousOrder: 'You haven’t ordered here yet.',
      thanks: 'Thank you 🙏 Write to us anytime, we’re here!',
    },
  },
};
