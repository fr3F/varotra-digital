import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleMessage, type IncomingMessage, PAYLOADS } from '../src/domain/conversation-engine.ts';
import { type CatalogProduct, type ConversationState, INITIAL_CONVERSATION } from '../src/domain/types.ts';

const catalog: CatalogProduct[] = [
  { id: 'huile', name: 'Huile Tiko 1L', sku: null, unitPrice: 9500, available: 3 },
  { id: 'savon', name: 'Savon Nosy', sku: null, unitPrice: 1500, available: 20 },
  { id: 'riz', name: 'Riz Makalioka', sku: null, unitPrice: 4000, available: 0 },
];
const ctx = { catalog, customerName: 'Rasoa' };

/** Enchaîne plusieurs messages et renvoie le dernier résultat. */
function converse(messages: IncomingMessage[], start: ConversationState = INITIAL_CONVERSATION) {
  let state = start;
  let last = handleMessage(state, messages[0] ?? { kind: 'UNSUPPORTED' }, ctx);
  state = last.state;
  for (const message of messages.slice(1)) {
    last = handleMessage(state, message, ctx);
    state = last.state;
  }
  return last;
}

const quick = (payload: string): IncomingMessage => ({ kind: 'QUICK_REPLY', payload, text: '' });

describe('conversation guidée', () => {
  it('accueille le client et propose seulement les produits disponibles', () => {
    const result = converse([{ kind: 'POSTBACK', payload: PAYLOADS.getStarted }]);
    const reply = result.replies[0];
    assert.match(reply?.text ?? '', /Bonjour Rasoa/);
    assert.deepEqual(reply?.quickReplies?.map((q) => q.payload), ['PRODUCT:huile', 'PRODUCT:savon']);
  });

  it('produit -> quantité (limitée au stock) -> panier -> validation', () => {
    const quantity = converse([quick(PAYLOADS.menu), quick(PAYLOADS.product('huile'))]);
    assert.deepEqual(quantity.replies[0]?.quickReplies?.map((q) => q.title), ['1', '2', '3']);

    const result = converse([
      quick(PAYLOADS.menu),
      quick(PAYLOADS.product('huile')),
      quick(PAYLOADS.quantity(2)),
      quick(PAYLOADS.checkout),
    ]);
    assert.equal(result.order?.mode, 'GUIDED');
    assert.deepEqual(result.order?.items, [{ productId: 'huile', productName: 'Huile Tiko 1L', quantity: 2, unitPrice: 9500 }]);
    assert.equal(result.order?.needsReview, false);
    assert.deepEqual(result.state, INITIAL_CONVERSATION);
  });

  it('accepte une quantité tapée au clavier', () => {
    const result = converse([quick(PAYLOADS.product('huile')), { kind: 'TEXT', text: '2' }, quick(PAYLOADS.checkout)]);
    assert.equal(result.order?.items[0]?.quantity, 2);
    assert.equal(result.order?.needsReview, false);
  });

  it('annule le panier', () => {
    const result = converse([quick(PAYLOADS.product('savon')), quick(PAYLOADS.quantity(1)), quick(PAYLOADS.cancel)]);
    assert.equal(result.order, undefined);
    assert.deepEqual(result.state.cart, []);
  });
});

describe('vérification du stock avant validation', () => {
  it('au-delà du stock : pas de bouton « Valider », proposition d’ajuster', () => {
    const cart = converse([{ kind: 'TEXT', text: 'mila huile tiko 50' }]);
    const reply = cart.replies[0];
    assert.match(reply?.text ?? '', /50 × Huile Tiko 1L — .* ⚠️ seulement 3 en stock/);
    assert.match(reply?.text ?? '', /Stock insuffisant : ajustez votre panier/);
    assert.deepEqual(reply?.quickReplies?.map((q) => q.payload), [PAYLOADS.adjust, PAYLOADS.menu, PAYLOADS.cancel]);
  });

  it('« Ajuster au stock » ramène la quantité au disponible, puis la commande est possible', () => {
    const adjusted = converse([{ kind: 'TEXT', text: 'mila huile tiko 50' }, quick(PAYLOADS.adjust)]);
    assert.match(adjusted.replies[0]?.text ?? '', /Panier ajusté[\s\S]*3 × Huile Tiko 1L/);
    assert.equal(adjusted.replies[0]?.quickReplies?.[0]?.payload, PAYLOADS.checkout);

    const result = converse([{ kind: 'TEXT', text: 'mila huile tiko 50' }, quick(PAYLOADS.adjust), quick(PAYLOADS.checkout)]);
    assert.equal(result.order?.items[0]?.quantity, 3);
    assert.equal(result.order?.needsReview, false);
  });

  it('un ancien bouton « Valider » ne crée pas de commande au-delà du stock', () => {
    const result = converse([{ kind: 'TEXT', text: 'mila huile tiko 50' }, quick(PAYLOADS.checkout)]);
    assert.equal(result.order, undefined);
    assert.match(result.replies[0]?.text ?? '', /Impossible de valider/);
  });

  it('produit épuisé : retiré du panier à l’ajustement', () => {
    const result = converse([{ kind: 'TEXT', text: 'mila huile tiko 2 sy riz makalioka 4' }, quick(PAYLOADS.adjust)]);
    const text = result.replies[0]?.text ?? '';
    assert.match(text, /2 × Huile Tiko 1L/);
    assert.doesNotMatch(text, /Riz/);
  });
});

describe('texte libre', () => {
  it('transforme le message en panier puis en commande « TEXT » avec le message d’origine', () => {
    const cart = converse([{ kind: 'TEXT', text: 'Bonjour, mila huile tiko 2 sy savon 3' }]);
    assert.match(cart.replies[0]?.text ?? '', /2 × Huile Tiko 1L/);
    assert.match(cart.replies[0]?.text ?? '', /Total : 23 500 Ar/);

    const result = converse([{ kind: 'TEXT', text: 'Bonjour, mila huile tiko 2 sy savon 3' }, quick(PAYLOADS.checkout)]);
    assert.equal(result.order?.mode, 'TEXT');
    assert.equal(result.order?.rawText, 'Bonjour, mila huile tiko 2 sy savon 3');
  });

  it('message incompris : le client peut l’envoyer tel quel au vendeur (commande « à vérifier »)', () => {
    const first = converse([{ kind: 'TEXT', text: 'Vous livrez à Toamasina ?' }]);
    assert.ok(first.replies[0]?.quickReplies?.some((q) => q.payload === PAYLOADS.sendRaw));

    const result = converse([{ kind: 'TEXT', text: 'Vous livrez à Toamasina ?' }, quick(PAYLOADS.sendRaw)]);
    assert.equal(result.order?.mode, 'RAW');
    assert.equal(result.order?.needsReview, true);
    assert.equal(result.order?.rawText, 'Vous livrez à Toamasina ?');
  });

  it('pièce jointe : demande un message écrit', () => {
    const result = converse([{ kind: 'UNSUPPORTED' }]);
    assert.match(result.replies[0]?.text ?? '', /messages écrits/);
  });
});
