import { formatMoney, normalizeText, truncate } from '../shared/format.ts';
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
  page: (page: number) => `PAGE:${page}`,
  product: (id: string) => `PRODUCT:${id}`,
  quantity: (quantity: number) => `QTY:${quantity}`,
} as const;

/** Produits proposés par page (Messenger : 13 réponses rapides maximum, dont « Suite » et « Panier »). */
const PAGE_SIZE = 10;
const MAX_QUANTITY_CHOICES = 5;

/** Mots qui déclenchent l'affichage du menu (français et malgache). */
const MENU_WORDS = new Set([
  'menu', 'catalogue', 'produit', 'produits', 'prix', 'commander', 'commande', 'bonjour', 'salut', 'hello', 'bonsoir',
  'salama', 'manao', 'akory', 'vidiny', 'lisitra', 'entana',
]);

const ACTIONS: Readonly<Record<'checkout' | 'adjust' | 'more' | 'cancel' | 'menu' | 'sendRaw', QuickReply>> = {
  checkout: { title: '✅ Valider', payload: PAYLOADS.checkout },
  adjust: { title: '✔️ Ajuster au stock', payload: PAYLOADS.adjust },
  more: { title: '➕ Autre produit', payload: PAYLOADS.menu },
  cancel: { title: '🗑️ Annuler', payload: PAYLOADS.cancel },
  menu: { title: '🛒 Voir les produits', payload: PAYLOADS.menu },
  sendRaw: { title: '📝 Envoyer au vendeur', payload: PAYLOADS.sendRaw },
};

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

function welcomeText(customerName: string | null): string {
  const greeting = customerName === null ? 'Bonjour 👋' : `Bonjour ${customerName} 👋`;
  return `${greeting}\nChoisissez un produit ci-dessous, ou écrivez directement votre commande, par exemple : « 2 huile tiko et 1 savon ».`;
}

function productMenu(state: ConversationState, ctx: EngineContext, page: number, intro?: string): EngineResult {
  const products = availableProducts(ctx.catalog);
  if (products.length === 0) {
    return {
      state: { ...state, step: { kind: 'IDLE' } },
      replies: [
        {
          text: `${intro === undefined ? '' : `${intro}\n\n`}Aucun produit n’est disponible pour le moment. Écrivez votre demande : le vendeur vous répondra.`,
          ...(state.unparsedText === null ? {} : { quickReplies: [ACTIONS.sendRaw] }),
        },
      ],
    };
  }
  const pageCount = Math.ceil(products.length / PAGE_SIZE);
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const visible = products.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const list = visible.map((product) => `• ${product.name} — ${formatMoney(product.unitPrice)}`).join('\n');
  const quickReplies: QuickReply[] = visible.map((product) => ({
    title: truncate(product.name, 20),
    payload: PAYLOADS.product(product.id),
  }));
  if (current + 1 < pageCount) {
    quickReplies.push({ title: 'Suite ▶', payload: PAYLOADS.page(current + 1) });
  }
  if (state.cart.length > 0) {
    quickReplies.push({ title: `🛒 Panier (${state.cart.length})`, payload: PAYLOADS.cart });
  }
  // Premier message non compris : il peut être transmis tel quel au vendeur.
  if (state.unparsedText !== null) {
    quickReplies.push(ACTIONS.sendRaw);
  }
  const header = pageCount > 1 ? `Nos produits (${current + 1}/${pageCount}) :` : 'Nos produits :';
  return {
    state: { ...state, step: { kind: 'CHOOSING_PRODUCT', page: current } },
    replies: [{ text: `${intro === undefined ? '' : `${intro}\n\n`}${header}\n${list}`, quickReplies }],
  };
}

function cartSummary(state: ConversationState, ctx: EngineContext, intro?: string): EngineResult {
  const items = cartItems(state.cart, ctx.catalog);
  if (items.length === 0) {
    return productMenu({ ...state, cart: [] }, ctx, 0, intro ?? 'Votre panier est vide.');
  }
  const lines = items.map((item) => {
    const available = availableOf(ctx.catalog, item.productId);
    const warning =
      item.quantity <= available ? '' : available === 0 ? ' ⚠️ épuisé' : ` ⚠️ seulement ${available} en stock`;
    return `• ${item.quantity} × ${item.productName} — ${formatMoney(item.quantity * item.unitPrice)}${warning}`;
  });
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  // Stock vérifié avant validation : un panier qui dépasse le stock ne peut pas être validé.
  const shortage = exceedsStock(items, ctx.catalog);
  const stockNote = shortage ? '\n\n⚠️ Stock insuffisant : ajustez votre panier pour pouvoir le valider.' : '';
  return {
    state: { ...state, step: { kind: 'CART' } },
    replies: [
      {
        text: `${intro === undefined ? '' : `${intro}\n\n`}Votre panier :\n${lines.join('\n')}\nTotal : ${formatMoney(total)}${stockNote}`,
        quickReplies: shortage ? [ACTIONS.adjust, ACTIONS.more, ACTIONS.cancel] : [ACTIONS.checkout, ACTIONS.more, ACTIONS.cancel],
      },
    ],
  };
}

function askQuantity(state: ConversationState, ctx: EngineContext, productId: string): EngineResult {
  const product = findProduct(ctx.catalog, productId);
  if (product === undefined || product.available <= 0) {
    return productMenu(state, ctx, 0, 'Désolé, ce produit n’est plus disponible.');
  }
  const choices = Array.from({ length: Math.min(product.available, MAX_QUANTITY_CHOICES) }, (_, index) => index + 1);
  return {
    state: { ...state, step: { kind: 'CHOOSING_QUANTITY', productId } },
    replies: [
      {
        text: `${product.name} — ${formatMoney(product.unitPrice)}\nCombien en voulez-vous ? (ou écrivez un nombre)`,
        quickReplies: choices.map((quantity) => ({ title: String(quantity), payload: PAYLOADS.quantity(quantity) })),
      },
    ],
  };
}

function addQuantity(state: ConversationState, ctx: EngineContext, productId: string, quantity: number): EngineResult {
  const product = findProduct(ctx.catalog, productId);
  if (product === undefined) {
    return productMenu(state, ctx, 0, 'Désolé, ce produit n’est plus disponible.');
  }
  return cartSummary({ ...state, cart: addToCart(state.cart, productId, quantity) }, ctx, `C’est noté : ${quantity} × ${product.name}.`);
}

/** Chaque ligne ramenée au stock disponible ; les produits épuisés sont retirés du panier. */
function adjustToStock(state: ConversationState, ctx: EngineContext): EngineResult {
  const cart = state.cart.flatMap((item) => {
    const quantity = Math.min(item.quantity, availableOf(ctx.catalog, item.productId));
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
  if (cart.length === 0) {
    return productMenu({ ...state, cart: [] }, ctx, 0, 'Désolé, ces produits sont épuisés pour le moment.');
  }
  return cartSummary({ ...state, cart }, ctx, 'Panier ajusté au stock disponible 👍');
}

function checkout(state: ConversationState, ctx: EngineContext): EngineResult {
  const items = cartItems(state.cart, ctx.catalog);
  if (items.length === 0) {
    return productMenu({ ...state, cart: [] }, ctx, 0, 'Votre panier est vide.');
  }
  // Ancien bouton « Valider » ou stock modifié entre-temps : rien n'est commandé au-delà du stock.
  if (exceedsStock(items, ctx.catalog)) {
    return cartSummary(state, ctx, 'Impossible de valider : stock insuffisant.');
  }
  return {
    state: INITIAL_CONVERSATION,
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
    case PAYLOADS.cancel:
      return {
        state: INITIAL_CONVERSATION,
        replies: [{ text: 'Votre panier a été vidé. Écrivez « menu » pour recommencer.', quickReplies: [ACTIONS.menu] }],
      };
    case PAYLOADS.sendRaw: {
      if (state.unparsedText === null) {
        return productMenu(state, ctx, 0);
      }
      const items = cartItems(state.cart, ctx.catalog);
      return {
        state: INITIAL_CONVERSATION,
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
      return productMenu(state, ctx, 0, welcomeText(ctx.customerName));
  }
}

function handleText(text: string, state: ConversationState, ctx: EngineContext): EngineResult {
  const words = normalizeText(text).split(' ');

  // Réponse à « Combien en voulez-vous ? » écrite au clavier.
  if (state.step.kind === 'CHOOSING_QUANTITY' && words.length === 1 && /^\d{1,3}$/.test(words[0] ?? '')) {
    const quantity = Number(words[0]);
    if (quantity > 0) {
      return addQuantity(state, ctx, state.step.productId, quantity);
    }
  }

  const parsed = parseOrderMessage(text, ctx.catalog);
  if (parsed.lines.length > 0) {
    const cart = parsed.lines.reduce((current, line) => addToCart(current, line.productId, line.quantity), [...state.cart]);
    const note =
      parsed.unmatched.length > 0 ? `Je n’ai pas reconnu : « ${parsed.unmatched.join(' », « ')} ».` : undefined;
    return cartSummary({ ...state, cart, rawTexts: [...state.rawTexts, text], unparsedText: null }, ctx, note);
  }

  if (words.some((word) => MENU_WORDS.has(word)) || state.step.kind === 'IDLE') {
    const intro = state.step.kind === 'IDLE' ? welcomeText(ctx.customerName) : undefined;
    return productMenu({ ...state, unparsedText: state.step.kind === 'IDLE' ? text : null }, ctx, 0, intro);
  }

  const quickReplies = state.cart.length > 0 ? [ACTIONS.checkout, ACTIONS.menu, ACTIONS.sendRaw] : [ACTIONS.menu, ACTIONS.sendRaw];
  return {
    state: { ...state, unparsedText: text },
    replies: [
      {
        text: 'Je n’ai pas bien compris 🙏 Choisissez un produit dans la liste, ou envoyez votre message tel quel au vendeur.',
        quickReplies,
      },
    ],
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
        replies: [{ text: 'Je ne peux lire que les messages écrits pour le moment. Écrivez votre commande 🙂', quickReplies: [ACTIONS.menu] }],
      };
  }
}

/** Confirmation envoyée au client une fois la commande enregistrée. */
export function confirmationReply(draft: OrderDraft): OutgoingReply {
  if (draft.mode === 'RAW') {
    return { text: `Merci ! Votre message a été transmis au vendeur (réf. ${draft.reference}). Il vous répondra très vite.` };
  }
  const total = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lines = draft.items.map((item) => `• ${item.quantity} × ${item.productName}`).join('\n');
  return {
    text: `Commande reçue ✅ (réf. ${draft.reference})\n${lines}\nTotal : ${formatMoney(total)}\nLe vendeur vous confirmera la disponibilité et la livraison.`,
  };
}
