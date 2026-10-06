import { formatMoney, normalizeText, truncate } from '../shared/format.ts';
import { detectLanguage, type Lang, MESSAGES, type Messages } from './i18n.ts';
import { quantityOnly, replaceNumberWords } from './numbers.ts';
import { parseOrderMessage } from './order-parser.ts';
import {
  type CartItem,
  type CatalogProduct,
  type ConversationState,
  type DraftItem,
  type DraftMode,
  INITIAL_CONVERSATION,
  type OrderDraft,
  type OutgoingReply,
  type QuickReply,
} from './types.ts';

/** Message reçu d'un client, réduit à ce qui compte pour la conversation. */
export type IncomingMessage =
  | { readonly kind: 'TEXT'; readonly text: string }
  | { readonly kind: 'QUICK_REPLY'; readonly payload: string; readonly text: string }
  | { readonly kind: 'POSTBACK'; readonly payload: string }
  | { readonly kind: 'UNSUPPORTED' };

export interface EngineContext {
  /** Catalogue envoyé par l'application (produits et quantités disponibles). */
  readonly catalog: readonly CatalogProduct[];
  readonly customerName: string | null;
  /** Produits les plus commandés récemment (réels), du plus au moins demandé. */
  readonly popularIds?: readonly string[];
  /** Lignes de la dernière commande de ce client (« toy ny teo » / « comme avant »). */
  readonly lastOrderItems?: readonly DraftItem[];
  /** Produits déjà commandés par ce client, du plus récent au plus ancien. */
  readonly customerProductIds?: readonly string[];
}

/** Mots de question : prix, disponibilité, description (malgache, français, anglais). */
const QUESTION_WORDS = new Set([
  'ohatrinona', 'hoatrinona', 'vidiny', 'misy', 'mbola', 'inona', 'habe', 'loko', 've',
  'combien', 'prix', 'coute', 'cout', 'disponible', 'dispo', 'reste', 'quoi', 'taille', 'couleur', 'details',
  'how', 'much', 'price', 'cost', 'available', 'what', 'size', 'color', 'colour',
]);
/** « toy ny teo », « comme la dernière fois », « same as last time »… */
const REORDER_PHRASES = [
  'toy ny teo', 'mitovy amin ny teo', 'ilay teo', 'averina', 'comme la derniere fois', 'comme avant', 'meme commande',
  'la meme chose', 'same as last time', 'same again', 'reorder', 'same order',
];
const THANKS_WORDS = new Set(['misaotra', 'merci', 'thanks', 'thank', 'thx', 'mersi', 'tsara', 'super', 'cool']);

function isReturningCustomer(ctx: EngineContext): boolean {
  return (ctx.lastOrderItems ?? []).length > 0;
}

/** En dessous de ce stock, le client est prévenu qu'il en reste peu (vrai chiffre, jamais inventé). */
const LOW_STOCK = 3;
/** Produits proposés en plus dans le panier. */
const MAX_SUGGESTIONS = 2;

function isPopular(ctx: EngineContext, productId: string): boolean {
  return (ctx.popularIds ?? []).includes(productId);
}

/** Les plus demandés d'abord (dans l'ordre des ventes), puis les autres dans l'ordre du catalogue. */
function byPopularity(ctx: EngineContext, products: readonly CatalogProduct[]): CatalogProduct[] {
  const rank = (product: CatalogProduct) => {
    const index = (ctx.popularIds ?? []).indexOf(product.id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...products].sort((a, b) => rank(a) - rank(b));
}

/** Pour ce client : ce qu'il a déjà acheté d'abord, puis les plus demandés. */
function forCustomer(ctx: EngineContext, products: readonly CatalogProduct[]): CatalogProduct[] {
  const bought = ctx.customerProductIds ?? [];
  const rank = (product: CatalogProduct) => {
    const index = bought.indexOf(product.id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return byPopularity(ctx, products).sort((a, b) => rank(a) - rank(b));
}

export interface OrderRequest {
  readonly mode: DraftMode;
  readonly items: readonly DraftItem[];
  readonly rawText: string | null;
  readonly needsReview: boolean;
}

export interface EngineResult {
  readonly state: ConversationState;
  readonly replies: readonly OutgoingReply[];
  /** Présent quand le client valide : le service crée la commande puis envoie la confirmation. */
  readonly order?: OrderRequest;
}

/** Charges utiles des boutons de réponse rapide. */
export const PAYLOADS = {
  getStarted: 'GET_STARTED',
  menu: 'MENU',
  cart: 'CART',
  checkout: 'CHECKOUT',
  /** Ramène le panier aux quantités en stock (proposé à la place de « Valider » quand il manque du stock). */
  adjust: 'ADJUST',
  cancel: 'CANCEL',
  sendRaw: 'SEND_RAW',
  /** Remet la dernière commande du client dans le panier. */
  reorder: 'REORDER',
  page: (page: number) => `PAGE:${page}`,
  product: (id: string) => `PRODUCT:${id}`,
  quantity: (quantity: number) => `QTY:${quantity}`,
} as const;

/** Produits proposés par page (Messenger : 13 réponses rapides maximum, dont « Suite » et « Panier »). */
const PAGE_SIZE = 10;
const MAX_QUANTITY_CHOICES = 5;

/** Mots qui déclenchent l'affichage du menu (français, malgache, anglais). */
const MENU_WORDS = new Set([
  'menu', 'catalogue', 'produit', 'produits', 'prix', 'commander', 'commande', 'bonjour', 'salut', 'hello', 'bonsoir',
  'salama', 'manao', 'akory', 'vidiny', 'lisitra', 'entana', 'inona', 'varotra',
  'hi', 'products', 'product', 'catalog', 'price', 'prices', 'shop', 'order',
]);

/** Réponses écrites qui valent « Valider » / « Annuler » quand le panier est affiché. */
const CONFIRM_WORDS = new Set(['valider', 'valide', 'oui', 'ok', 'okay', 'confirmer', 'eny', 'ekena', 'hamafisina', 'yes', 'confirm']);
const CANCEL_WORDS = new Set(['annuler', 'annule', 'foanana', 'ajanony', 'cancel']);

type ActionKey = 'checkout' | 'adjust' | 'more' | 'cancel' | 'menu' | 'sendRaw';

const ACTION_PAYLOADS: Readonly<Record<ActionKey, string>> = {
  checkout: PAYLOADS.checkout,
  adjust: PAYLOADS.adjust,
  more: PAYLOADS.menu,
  cancel: PAYLOADS.cancel,
  menu: PAYLOADS.menu,
  sendRaw: PAYLOADS.sendRaw,
};

/** Bouton de réponse rapide dans la langue du client. */
function action(lang: Lang, key: ActionKey): QuickReply {
  return { title: MESSAGES[lang].buttons[key], payload: ACTION_PAYLOADS[key] };
}

function t(state: ConversationState): Messages {
  return MESSAGES[state.lang];
}

/** Nouvelle conversation, en gardant la langue du client. */
function resetState(state: ConversationState): ConversationState {
  return { ...INITIAL_CONVERSATION, lang: state.lang };
}

function welcome(state: ConversationState, ctx: EngineContext): string {
  return isReturningCustomer(ctx) ? t(state).smart.welcomeBack(ctx.customerName) : t(state).welcome(ctx.customerName);
}

/** Remet la dernière commande dans le panier (produits encore au catalogue) ; le stock est vérifié au panier. */
function reorder(state: ConversationState, ctx: EngineContext): EngineResult {
  const cart = (ctx.lastOrderItems ?? [])
    .filter((item) => findProduct(ctx.catalog, item.productId) !== undefined)
    .reduce<CartItem[]>((current, item) => addToCart(current, item.productId, item.quantity), []);
  if (cart.length === 0) {
    return productMenu(state, ctx, 0, t(state).smart.noPreviousOrder);
  }
  return cartSummary({ ...state, cart }, ctx, t(state).smart.reorderIntro);
}

/**
 * Question sur un ou plusieurs produits (« ohatrinona ny kiraro ? », « vous avez des casquettes ? ») :
 * prix, disponibilité réelle et description. Un seul produit disponible : on demande la quantité.
 */
function answerQuestion(state: ConversationState, ctx: EngineContext, productIds: readonly string[]): EngineResult {
  const products = productIds
    .map((id) => findProduct(ctx.catalog, id))
    .filter((product): product is CatalogProduct => product !== undefined)
    .slice(0, 3);
  const blocks = products.map((product) =>
    [
      `${product.name} — ${formatMoney(product.unitPrice)}`,
      product.description,
      product.available <= 0
        ? t(state).smart.soldOutNow
        : product.available <= LOW_STOCK
          ? t(state).sales.lowStockLine(product.available)
          : t(state).smart.inStock,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  );
  const available = products.filter((product) => product.available > 0);
  if (available.length === 0) {
    return productMenu(state, ctx, 0, `${blocks.join('\n\n')}\n\n${t(state).smart.soldOutAlternatives}`);
  }
  const single = available.length === 1 ? available[0] : undefined;
  if (single !== undefined) {
    const choices = Array.from({ length: Math.min(single.available, MAX_QUANTITY_CHOICES) }, (_, index) => index + 1);
    return {
      state: { ...state, step: { kind: 'CHOOSING_QUANTITY', productId: single.id } },
      replies: [
        {
          text: `${blocks.join('\n\n')}\n\n${t(state).smart.askQuantity}`,
          quickReplies: [
            ...choices.map((quantity) => ({ title: String(quantity), payload: PAYLOADS.quantity(quantity) })),
            action(state.lang, 'menu'),
          ],
        },
      ],
    };
  }
  return {
    state: { ...state, step: { kind: 'IDLE' } },
    replies: [
      {
        text: blocks.join('\n\n'),
        quickReplies: [
          ...available.map((product) => ({ title: truncate(t(state).smart.buy(product.name), 20), payload: PAYLOADS.product(product.id) })),
          action(state.lang, 'menu'),
        ],
      },
    ],
  };
}

function availableProducts(catalog: readonly CatalogProduct[]): CatalogProduct[] {
  return catalog.filter((product) => product.available > 0);
}

function findProduct(catalog: readonly CatalogProduct[], id: string): CatalogProduct | undefined {
  return catalog.find((product) => product.id === id);
}

function addToCart(cart: readonly CartItem[], productId: string, quantity: number): CartItem[] {
  const existing = cart.find((item) => item.productId === productId);
  return existing === undefined
    ? [...cart, { productId, quantity }]
    : cart.map((item) => (item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item));
}

/** Lignes du panier encore présentes au catalogue, avec nom et prix actuels. */
function cartItems(cart: readonly CartItem[], catalog: readonly CatalogProduct[]): DraftItem[] {
  return cart.flatMap((item) => {
    const product = findProduct(catalog, item.productId);
    return product === undefined
      ? []
      : [{ productId: product.id, productName: product.name, quantity: item.quantity, unitPrice: product.unitPrice }];
  });
}

function availableOf(catalog: readonly CatalogProduct[], productId: string): number {
  return findProduct(catalog, productId)?.available ?? 0;
}

function exceedsStock(items: readonly DraftItem[], catalog: readonly CatalogProduct[]): boolean {
  return items.some((item) => item.quantity > availableOf(catalog, item.productId));
}

function productMenu(state: ConversationState, ctx: EngineContext, page: number, intro?: string): EngineResult {
  const products = byPopularity(ctx, availableProducts(ctx.catalog));
  if (products.length === 0) {
    return {
      state: { ...state, step: { kind: 'IDLE' } },
      replies: [
        {
          text: `${intro === undefined ? '' : `${intro}\n\n`}${t(state).noProducts}`,
          ...(state.unparsedText === null ? {} : { quickReplies: [action(state.lang, 'sendRaw')] }),
        },
      ],
    };
  }
  const pageCount = Math.ceil(products.length / PAGE_SIZE);
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const visible = products.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const list = visible
    .map((product) => {
      const tags = [
        isPopular(ctx, product.id) ? '⭐' : null,
        product.available <= LOW_STOCK ? t(state).sales.lowStockTag(product.available) : null,
      ].filter((tag): tag is string => tag !== null);
      return `• ${product.name} — ${formatMoney(product.unitPrice)}${tags.length > 0 ? ` ${tags.join(' ')}` : ''}`;
    })
    .join('\n');
  const legend = visible.some((product) => isPopular(ctx, product.id)) ? `\n${t(state).sales.legend}` : '';
  const quickReplies: QuickReply[] = visible.map((product) => ({
    title: truncate(product.name, 20),
    payload: PAYLOADS.product(product.id),
  }));
  if (current + 1 < pageCount) {
    quickReplies.push({ title: t(state).buttons.next, payload: PAYLOADS.page(current + 1) });
  }
  if (state.cart.length > 0) {
    quickReplies.push({ title: t(state).buttons.cart(state.cart.length), payload: PAYLOADS.cart });
  }
  // Client fidèle : sa dernière commande en un bouton.
  if (isReturningCustomer(ctx) && state.cart.length === 0) {
    quickReplies.unshift({ title: t(state).smart.reorder, payload: PAYLOADS.reorder });
  }
  // Premier message non compris : il peut être transmis tel quel au vendeur.
  if (state.unparsedText !== null) {
    quickReplies.push(action(state.lang, 'sendRaw'));
  }
  const header = t(state).productsHeader(current + 1, pageCount);
  return {
    state: { ...state, step: { kind: 'CHOOSING_PRODUCT', page: current } },
    replies: [{ text: `${intro === undefined ? '' : `${intro}\n\n`}${header}\n${list}${legend}`, quickReplies }],
  };
}

function cartSummary(state: ConversationState, ctx: EngineContext, intro?: string): EngineResult {
  const items = cartItems(state.cart, ctx.catalog);
  if (items.length === 0) {
    return productMenu({ ...state, cart: [] }, ctx, 0, intro ?? t(state).emptyCart);
  }
  const lines = items.map((item) => {
    const available = availableOf(ctx.catalog, item.productId);
    const warning =
      item.quantity <= available ? '' : available === 0 ? ` ${t(state).soldOut}` : ` ${t(state).onlyInStock(available)}`;
    return `• ${item.quantity} × ${item.productName} — ${formatMoney(item.quantity * item.unitPrice)}${warning}`;
  });
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  // Stock vérifié avant validation : un panier qui dépasse le stock ne peut pas être validé.
  const shortage = exceedsStock(items, ctx.catalog);
  // Panier valide : produits complémentaires (les plus demandés d'abord) et invitation à valider.
  const suggestions = shortage
    ? []
    : forCustomer(ctx, availableProducts(ctx.catalog))
        .filter((product) => !state.cart.some((item) => item.productId === product.id))
        .slice(0, MAX_SUGGESTIONS);
  const notes = shortage
    ? [t(state).stockShortage]
    : [
        suggestions.length > 0
          ? t(state).sales.suggestion(suggestions.map((product) => `${product.name} (${formatMoney(product.unitPrice)})`).join(', '))
          : null,
        t(state).sales.nudge,
      ].filter((note): note is string => note !== null);
  const quickReplies: QuickReply[] = [
    action(state.lang, shortage ? 'adjust' : 'checkout'),
    ...suggestions.map((product) => ({ title: truncate(`➕ ${product.name}`, 20), payload: PAYLOADS.product(product.id) })),
    action(state.lang, 'more'),
    action(state.lang, 'cancel'),
  ];
  return {
    state: { ...state, step: { kind: 'CART' } },
    replies: [
      {
        text: `${intro === undefined ? '' : `${intro}\n\n`}${t(state).cartTitle}\n${lines.join('\n')}\n${t(state).total(formatMoney(total))}\n\n${notes.join('\n')}`,
        quickReplies,
      },
    ],
  };
}

function askQuantity(state: ConversationState, ctx: EngineContext, productId: string): EngineResult {
  const product = findProduct(ctx.catalog, productId);
  if (product === undefined || product.available <= 0) {
    return productMenu(state, ctx, 0, t(state).productUnavailable);
  }
  const choices = Array.from({ length: Math.min(product.available, MAX_QUANTITY_CHOICES) }, (_, index) => index + 1);
  return {
    state: { ...state, step: { kind: 'CHOOSING_QUANTITY', productId } },
    replies: [
      {
        text: t(state).howMany(
          product.name,
          formatMoney(product.unitPrice),
          [
            product.description,
            isPopular(ctx, product.id) ? t(state).sales.popularLine : null,
            product.available <= LOW_STOCK ? t(state).sales.lowStockLine(product.available) : null,
          ].filter((line): line is string => line !== null),
        ),
        quickReplies: choices.map((quantity) => ({ title: String(quantity), payload: PAYLOADS.quantity(quantity) })),
      },
    ],
  };
}

function addQuantity(state: ConversationState, ctx: EngineContext, productId: string, quantity: number): EngineResult {
  const product = findProduct(ctx.catalog, productId);
  if (product === undefined) {
    return productMenu(state, ctx, 0, t(state).productUnavailable);
  }
  return cartSummary({ ...state, cart: addToCart(state.cart, productId, quantity) }, ctx, t(state).noted(quantity, product.name));
}

/** Chaque ligne ramenée au stock disponible ; les produits épuisés sont retirés du panier. */
function adjustToStock(state: ConversationState, ctx: EngineContext): EngineResult {
  const cart = state.cart.flatMap((item) => {
    const quantity = Math.min(item.quantity, availableOf(ctx.catalog, item.productId));
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
  if (cart.length === 0) {
    return productMenu({ ...state, cart: [] }, ctx, 0, t(state).allSoldOut);
  }
  return cartSummary({ ...state, cart }, ctx, t(state).adjusted);
}

function checkout(state: ConversationState, ctx: EngineContext): EngineResult {
  const items = cartItems(state.cart, ctx.catalog);
  if (items.length === 0) {
    return productMenu({ ...state, cart: [] }, ctx, 0, t(state).emptyCart);
  }
  // Ancien bouton « Valider » ou stock modifié entre-temps : rien n'est commandé au-delà du stock.
  if (exceedsStock(items, ctx.catalog)) {
    return cartSummary(state, ctx, t(state).cannotValidate);
  }
  return {
    state: resetState(state),
    replies: [],
    order: {
      mode: state.rawTexts.length > 0 ? 'TEXT' : 'GUIDED',
      items,
      rawText: state.rawTexts.length > 0 ? state.rawTexts.join('\n') : null,
      needsReview: exceedsStock(items, ctx.catalog),
    },
  };
}

function handlePayload(payload: string, state: ConversationState, ctx: EngineContext): EngineResult {
  const [command, argument = ''] = payload.split(':', 2);
  switch (command) {
    case PAYLOADS.menu:
      return productMenu(state, ctx, 0);
    case 'PAGE':
      return productMenu(state, ctx, Number(argument) || 0);
    case 'PRODUCT':
      return askQuantity(state, ctx, argument);
    case 'QTY': {
      const quantity = Number(argument);
      return state.step.kind === 'CHOOSING_QUANTITY' && Number.isInteger(quantity) && quantity > 0
        ? addQuantity(state, ctx, state.step.productId, quantity)
        : cartSummary(state, ctx);
    }
    case PAYLOADS.cart:
      return cartSummary(state, ctx);
    case PAYLOADS.checkout:
      return checkout(state, ctx);
    case PAYLOADS.adjust:
      return adjustToStock(state, ctx);
    case PAYLOADS.reorder:
      return reorder(state, ctx);
    case PAYLOADS.cancel:
      return {
        state: resetState(state),
        replies: [{ text: t(state).cartCleared, quickReplies: [action(state.lang, 'menu')] }],
      };
    case PAYLOADS.sendRaw: {
      if (state.unparsedText === null) {
        return productMenu(state, ctx, 0);
      }
      const items = cartItems(state.cart, ctx.catalog);
      return {
        state: resetState(state),
        replies: [],
        order: {
          mode: 'RAW',
          items,
          rawText: [...state.rawTexts, state.unparsedText].join('\n'),
          needsReview: true,
        },
      };
    }
    default:
      // GET_STARTED et toute charge inconnue : accueil.
      return productMenu(state, ctx, 0, welcome(state, ctx));
  }
}

function handleText(text: string, current: ConversationState, ctx: EngineContext): EngineResult {
  // Le bot répond dans la langue du dernier message reconnu (sinon, la langue précédente).
  const state: ConversationState = { ...current, lang: detectLanguage(text) ?? current.lang };
  const words = normalizeText(text).split(' ');

  // Réponse à « Combien en voulez-vous ? » écrite au clavier (« 3 », « roa », « twelve »…).
  if (state.step.kind === 'CHOOSING_QUANTITY') {
    const quantity = quantityOnly(words);
    if (quantity !== null && quantity > 0) {
      return addQuantity(state, ctx, state.step.productId, quantity);
    }
  }

  // « oui », « eny », « yes »… ou « annuler », « foanana », « cancel » devant le panier.
  if (state.step.kind === 'CART' && words.length <= 2) {
    if (words.some((word) => CONFIRM_WORDS.has(word))) {
      return checkout(state, ctx);
    }
    if (words.some((word) => CANCEL_WORDS.has(word))) {
      return handlePayload(PAYLOADS.cancel, state, ctx);
    }
  }

  const normalized = normalizeText(text);
  // « Misaotra », « merci », « thanks » seuls : réponse polie plutôt que « je n'ai pas compris ».
  if (words.length <= 4 && words.some((word) => THANKS_WORDS.has(word)) && parseOrderMessage(text, ctx.catalog).lines.length === 0) {
    return { state, replies: [{ text: t(state).smart.thanks, quickReplies: [action(state.lang, 'menu')] }] };
  }
  if (REORDER_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return reorder(state, ctx);
  }

  const parsed = parseOrderMessage(text, ctx.catalog);
  // Question sur un produit, sans quantité demandée : on répond (prix, stock, description) au lieu de remplir le panier.
  const asksQuestion = text.includes('?') || words.some((word) => QUESTION_WORDS.has(word));
  const hasQuantity = replaceNumberWords(words).some((word) => /^x?\d{1,3}x?$/.test(word));
  if (parsed.lines.length > 0 && asksQuestion && !hasQuantity) {
    return answerQuestion({ ...state, unparsedText: null }, ctx, parsed.lines.map((line) => line.productId));
  }
  if (parsed.lines.length > 0) {
    const cart = parsed.lines.reduce((current, line) => addToCart(current, line.productId, line.quantity), [...state.cart]);
    const note = parsed.unmatched.length > 0 ? t(state).notRecognized(parsed.unmatched) : undefined;
    return cartSummary({ ...state, cart, rawTexts: [...state.rawTexts, text], unparsedText: null }, ctx, note);
  }

  if (words.some((word) => MENU_WORDS.has(word)) || state.step.kind === 'IDLE') {
    const intro = state.step.kind === 'IDLE' ? welcome(state, ctx) : undefined;
    return productMenu({ ...state, unparsedText: state.step.kind === 'IDLE' ? text : null }, ctx, 0, intro);
  }

  const keys: ActionKey[] = state.cart.length > 0 ? ['checkout', 'menu', 'sendRaw'] : ['menu', 'sendRaw'];
  return {
    state: { ...state, unparsedText: text },
    replies: [{ text: t(state).notUnderstood, quickReplies: keys.map((key) => action(state.lang, key)) }],
  };
}

/**
 * Fait avancer la conversation d'un client d'un message. Fonction pure : aucune écriture,
 * aucun envoi. Le service enregistre l'état, crée la commande et envoie les réponses.
 */
export function handleMessage(state: ConversationState, message: IncomingMessage, ctx: EngineContext): EngineResult {
  switch (message.kind) {
    case 'QUICK_REPLY':
    case 'POSTBACK':
      return handlePayload(message.payload, state, ctx);
    case 'TEXT':
      return handleText(message.text, state, ctx);
    case 'UNSUPPORTED':
      return {
        state,
        replies: [{ text: t(state).textOnly, quickReplies: [action(state.lang, 'menu')] }],
      };
  }
}

/** Confirmation envoyée au client une fois la commande enregistrée, dans sa langue. */
export function confirmationReply(draft: OrderDraft, lang: Lang): OutgoingReply {
  const messages = MESSAGES[lang];
  if (draft.mode === 'RAW') {
    return { text: messages.rawSent(draft.reference) };
  }
  const total = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lines = draft.items.map((item) => `• ${item.quantity} × ${item.productName}`).join('\n');
  return { text: messages.receipt(draft.reference, lines, formatMoney(total)) };
}

/**
 * Relance d'un panier abandonné (une seule fois, dans les 24 h de Messenger) : rappel du panier
 * dans la langue du client, ou null si le panier est vide.
 */
export function cartReminder(state: ConversationState, ctx: EngineContext): OutgoingReply | null {
  if (cartItems(state.cart, ctx.catalog).length === 0) {
    return null;
  }
  return cartSummary(state, ctx, t(state).sales.cartWaiting).replies[0] ?? null;
}
