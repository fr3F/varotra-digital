import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cartReminder, handleMessage, type IncomingMessage, PAYLOADS } from '../src/domain/conversation-engine.ts';
import { type CatalogProduct, type ConversationState, INITIAL_CONVERSATION } from '../src/domain/types.ts';

const catalog: CatalogProduct[] = [
  { id: 'huile', name: 'Huile Tiko 1L', sku: null, unitPrice: 9500, available: 3, description: null },
  { id: 'savon', name: 'Savon Nosy', sku: null, unitPrice: 1500, available: 20, description: null },
  { id: 'riz', name: 'Riz Makalioka', sku: null, unitPrice: 4000, available: 0, description: null },
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

describe('bot vendeur (arguments réels)', () => {
  const salesCatalog: CatalogProduct[] = [
    { id: 'kiraro', name: 'Kiraro', sku: null, unitPrice: 12000, available: 10, description: 'Cuir véritable, tailles 38 à 44.' },
    { id: 'satroka', name: 'Satroka', sku: null, unitPrice: 2000, available: 2, description: null },
    { id: 'akanjo', name: 'Akanjo', sku: null, unitPrice: 15000, available: 8, description: null },
  ];
  const sales = { catalog: salesCatalog, customerName: 'Rasoa', popularIds: ['akanjo'] };
  const say = (messages: IncomingMessage[]) => {
    let state = INITIAL_CONVERSATION;
    let result = handleMessage(state, messages[0] ?? { kind: 'UNSUPPORTED' }, sales);
    for (const message of messages.slice(1)) {
      state = result.state;
      result = handleMessage(state, message, sales);
    }
    return result;
  };

  it('menu : les plus demandés en premier (⭐) et stock faible signalé (🔥)', () => {
    const reply = say([{ kind: 'POSTBACK', payload: PAYLOADS.getStarted }]).replies[0];
    assert.match(reply?.text ?? '', /Bienvenue/);
    assert.match(reply?.text ?? '', /Nos produits :\n• Akanjo — 15\D000\sAr ⭐\n• Kiraro/);
    assert.match(reply?.text ?? '', /Satroka — 2\D000\sAr 🔥 plus que 2/);
    assert.match(reply?.text ?? '', /⭐ = les plus demandés/);
    assert.equal(reply?.quickReplies?.[0]?.payload, PAYLOADS.product('akanjo'));
  });

  it('choix du produit : description et stock faible', () => {
    assert.match(say([quick(PAYLOADS.product('kiraro'))]).replies[0]?.text ?? '', /Cuir véritable, tailles 38 à 44\./);
    assert.match(say([quick(PAYLOADS.product('satroka'))]).replies[0]?.text ?? '', /🔥 Plus que 2 en stock/);
    assert.match(say([quick(PAYLOADS.product('akanjo'))]).replies[0]?.text ?? '', /⭐ Très demandé en ce moment/);
  });

  it('panier : produits complémentaires et invitation à valider', () => {
    const reply = say([{ kind: 'TEXT', text: 'Bonjour, je voudrais 1 kiraro' }]).replies[0];
    assert.match(reply?.text ?? '', /💡 Souvent pris avec : Akanjo \(15\D000\sAr\), Satroka/);
    assert.match(reply?.text ?? '', /👉 Validez maintenant/);
    assert.deepEqual(reply?.quickReplies?.map((q) => q.payload), [
      PAYLOADS.checkout, PAYLOADS.product('akanjo'), PAYLOADS.product('satroka'), PAYLOADS.menu, PAYLOADS.cancel,
    ]);
  });

  it('relance : rappel du panier dans la langue du client, rien si le panier est vide', () => {
    const cart = say([{ kind: 'TEXT', text: 'Salama, mila kiraro roa' }]).state;
    assert.match(cartReminder(cart, sales)?.text ?? '', /^Mbola miandry anao ny haronao 🛒/);
    assert.equal(cartReminder(INITIAL_CONVERSATION, sales), null);
  });
});

describe('bot intelligent', () => {
  const smartCatalog: CatalogProduct[] = [
    { id: 'kiraro', name: 'Kiraro', sku: null, unitPrice: 12000, available: 10, description: 'Hoditra tena izy, habe 38 ka hatramin’ny 44.' },
    { id: 'casquette', name: 'Casquette', sku: null, unitPrice: 2000, available: 0, description: null },
    { id: 'tshirt', name: 'T-shirt', sku: null, unitPrice: 8000, available: 2, description: null },
  ];
  const fidele = {
    catalog: smartCatalog,
    customerName: 'Rasoa',
    lastOrderItems: [{ productId: 'kiraro', productName: 'Kiraro', quantity: 2, unitPrice: 12000 }],
    customerProductIds: ['tshirt', 'kiraro'],
  };
  const nouveau = { catalog: smartCatalog, customerName: 'Rasoa' };
  const say = (text: string, context: Parameters<typeof handleMessage>[2] = nouveau) =>
    handleMessage(INITIAL_CONVERSATION, { kind: 'TEXT', text }, context);

  it('comprend une faute de frappe', () => {
    assert.match(say('mila kirarro 2').replies[0]?.text ?? '', /2 × Kiraro/);
    assert.match(say('je voudrais 1 tshirtt').replies[0]?.text ?? '', /1 × T-shirt/);
  });

  it('répond à une question de prix : prix, description, stock, puis demande la quantité', () => {
    const result = say('Ohatrinona ny kiraro ?');
    const text = result.replies[0]?.text ?? '';
    assert.match(text, /^Kiraro — 12\D000\sAr\nHoditra tena izy/);
    assert.match(text, /✅ Misy\n\nFiry no ilainao \?/);
    assert.equal(result.state.step.kind, 'CHOOSING_QUANTITY');
    assert.equal(result.order, undefined);
    // Le client répond simplement « roa » : 2 kiraro dans le panier.
    const next = handleMessage(result.state, { kind: 'TEXT', text: 'roa' }, nouveau);
    assert.match(next.replies[0]?.text ?? '', /2 × Kiraro/);
  });

  it('disponibilité : stock faible, épuisé avec alternatives', () => {
    assert.match(say('Is the t-shirt available?').replies[0]?.text ?? '', /🔥 Only 2 left in stock/);
    const soldOut = say('Vous avez des casquettes ?').replies[0]?.text ?? '';
    assert.match(soldOut, /Casquette — 2\D000\sAr\n😔 Épuisé pour le moment/);
    assert.match(soldOut, /Voici ce qui est disponible :[\s\S]*Kiraro/);
  });

  it('plusieurs produits demandés : un bouton par produit disponible', () => {
    const reply = say('Combien coûtent le kiraro et le t-shirt ?').replies[0];
    assert.match(reply?.text ?? '', /Kiraro — [\s\S]*T-shirt —/);
    assert.deepEqual(reply?.quickReplies?.map((q) => q.payload), [PAYLOADS.product('kiraro'), PAYLOADS.product('tshirt'), PAYLOADS.menu]);
  });

  it('une quantité dans le message reste une commande, même avec « ve »', () => {
    assert.match(say('mila kiraro 2 ve').replies[0]?.text ?? '', /^Ny haronao :\n• 2 × Kiraro/);
  });

  it('client fidèle : accueil personnalisé, « toy ny teo » et suggestions selon ses achats', () => {
    const hello = say('Salama', fidele).replies[0];
    assert.match(hello?.text ?? '', /^Faly mahita anao indray Rasoa 👋/);
    assert.equal(hello?.quickReplies?.[0]?.payload, PAYLOADS.reorder);

    const again = say('toy ny teo azafady', fidele).replies[0]?.text ?? '';
    assert.match(again, /^Ity ny kaomandinao farany[\s\S]*2 × Kiraro — 24\D000\sAr/);
    // Déjà acheté par ce client : proposé en premier.
    assert.match(again, /Matetika miaraka amin’ny : T-shirt/);

    // Bouton sans texte : langue par défaut (français).
    assert.match(handleMessage(INITIAL_CONVERSATION, quick(PAYLOADS.reorder), nouveau).replies[0]?.text ?? '', /Vous n’avez pas encore commandé ici/);
  });

  it('remerciements : réponse polie', () => {
    assert.match(say('Misaotra betsaka').replies[0]?.text ?? '', /^Misaotra anao koa 🙏/);
    assert.match(say('Merci !').replies[0]?.text ?? '', /^Merci à vous 🙏/);
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
