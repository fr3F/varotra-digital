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
    // Message en malgache : réponse en malgache.
    assert.match(reply?.text ?? '', /50 × Huile Tiko 1L — .* ⚠️ 3 sisa no misy/);
    assert.match(reply?.text ?? '', /Tsy ampy ny tahiry/);
    assert.deepEqual(reply?.quickReplies?.map((q) => q.payload), [PAYLOADS.adjust, PAYLOADS.menu, PAYLOADS.cancel]);
  });

  it('« Ajuster au stock » ramène la quantité au disponible, puis la commande est possible', () => {
    const adjusted = converse([{ kind: 'TEXT', text: 'mila huile tiko 50' }, quick(PAYLOADS.adjust)]);
    assert.match(adjusted.replies[0]?.text ?? '', /Nahitsy araka ny tahiry[\s\S]*3 × Huile Tiko 1L/);
    assert.equal(adjusted.replies[0]?.quickReplies?.[0]?.payload, PAYLOADS.checkout);

    const result = converse([{ kind: 'TEXT', text: 'mila huile tiko 50' }, quick(PAYLOADS.adjust), quick(PAYLOADS.checkout)]);
    assert.equal(result.order?.items[0]?.quantity, 3);
    assert.equal(result.order?.needsReview, false);
  });

  it('un ancien bouton « Valider » ne crée pas de commande au-delà du stock', () => {
    const result = converse([{ kind: 'TEXT', text: 'mila huile tiko 50' }, quick(PAYLOADS.checkout)]);
    assert.equal(result.order, undefined);
    assert.match(result.replies[0]?.text ?? '', /Tsy azo hamafisina/);
  });

  it('produit épuisé : retiré du panier à l’ajustement', () => {
    const result = converse([{ kind: 'TEXT', text: 'mila huile tiko 2 sy riz makalioka 4' }, quick(PAYLOADS.adjust)]);
    const text = result.replies[0]?.text ?? '';
    assert.match(text, /2 × Huile Tiko 1L/);
    assert.doesNotMatch(text, /Riz/);
  });
});

describe('langues : malgache, français, anglais', () => {
  it('répond dans la langue du client et garde cette langue pour les boutons', () => {
    const mg = converse([{ kind: 'TEXT', text: 'Salama, mila savon roa azafady' }]).replies[0];
    assert.match(mg?.text ?? '', /^Ny haronao :\n• 2 × Savon Nosy/);
    assert.equal(mg?.quickReplies?.[0]?.title, '✅ Hamafisina');

    const fr = converse([{ kind: 'TEXT', text: 'Bonjour, je voudrais deux savons svp' }]).replies[0];
    assert.match(fr?.text ?? '', /^Votre panier :\n• 2 × Savon Nosy/);
    assert.equal(fr?.quickReplies?.[0]?.title, '✅ Valider');

    const en = converse([{ kind: 'TEXT', text: 'Hi, I would like two savon please' }]).replies[0];
    assert.match(en?.text ?? '', /^Your cart:\n• 2 × Savon Nosy/);
    assert.equal(en?.quickReplies?.[0]?.title, '✅ Confirm');
  });

  it('lit les nombres en lettres (malgache, français, anglais)', () => {
    const quantity = (text: string) => converse([{ kind: 'TEXT', text }]).replies[0]?.text.match(/(\d+) × Savon Nosy/)?.[1];
    assert.equal(quantity('mila savon roa ambin’ny folo'), '12');
    assert.equal(quantity('mila savon dimy amby roapolo'), '25');
    assert.equal(quantity('savon vingt cinq'), '25');
    assert.equal(quantity('twelve savon please'), '12');
    assert.equal(quantity('une douzaine de savon'), '12');
  });

  it('« eny » / « yes » / « oui » valident le panier, la quantité peut être écrite en lettres', () => {
    for (const word of ['eny', 'yes', 'oui']) {
      const result = converse([{ kind: 'TEXT', text: 'savon 2' }, { kind: 'TEXT', text: word }]);
      assert.equal(result.order?.items[0]?.quantity, 2, word);
    }
    const typed = converse([quick(PAYLOADS.product('savon')), { kind: 'TEXT', text: 'telo' }]);
    assert.match(typed.replies[0]?.text ?? '', /3 × Savon Nosy/);
  });

  it('autre langue : les chiffres et les noms de produits restent compris', () => {
    const result = converse([{ kind: 'TEXT', text: 'Hola, quiero 3 savon' }]);
    assert.match(result.replies[0]?.text ?? '', /3 × Savon Nosy/);
  });
});

describe('texte libre', () => {
  it('transforme le message en panier puis en commande « TEXT » avec le message d’origine', () => {
    const cart = converse([{ kind: 'TEXT', text: 'Bonjour, mila huile tiko 2 sy savon 3' }]);
    assert.match(cart.replies[0]?.text ?? '', /2 × Huile Tiko 1L/);
    assert.match(cart.replies[0]?.text ?? '', /Totaly : 23 500 Ar/);

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
