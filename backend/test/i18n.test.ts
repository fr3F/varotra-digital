import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notificationText, statusInquiryText } from '../src/domain/facebook-templates.ts';
import { detectLanguage, LANGS, MESSAGES } from '../src/domain/i18n.ts';
import { quantityOnly } from '../src/domain/numbers.ts';
import { CUSTOMER_ORDER_STATUSES, NOTIFICATION_EVENTS, type OrderDraft } from '../src/domain/types.ts';

const draft: OrderDraft = {
  id: 'd1',
  reference: 'MSG-20261006-001',
  psid: 'u1',
  customerName: 'Rasoa',
  mode: 'TEXT',
  items: [{ productId: 'p1', productName: 'Kiraro', quantity: 2, unitPrice: 12000 }],
  rawText: null,
  needsReview: false,
  createdAt: '2026-10-06T08:00:00.000Z',
  customerStatus: 'RECEIVED',
  customerStatusAt: null,
};

describe('détection de la langue', () => {
  it('reconnaît le malgache, le français et l’anglais', () => {
    assert.equal(detectLanguage('Salama, mila kiraro roa azafady'), 'mg');
    assert.equal(detectLanguage('Bonjour, je voudrais deux kiraro svp'), 'fr');
    assert.equal(detectLanguage('Hello, I need two kiraro please'), 'en');
  });

  it('ne tranche pas sans indice (la langue précédente est gardée)', () => {
    assert.equal(detectLanguage('Kiraro 2'), null);
    assert.equal(detectLanguage('👍'), null);
  });
});

describe('textes du bot dans chaque langue', () => {
  for (const lang of LANGS) {
    it(`${lang} : tous les textes sont remplis et les boutons tiennent dans Messenger (20 caractères)`, () => {
      const messages = MESSAGES[lang];
      const buttons = [
        ...Object.values(messages.buttons).filter((value): value is string => typeof value === 'string'),
        messages.buttons.cart(12),
      ];
      for (const title of buttons) {
        assert.ok(title.length > 0 && [...title].length <= 20, `${lang} : bouton « ${title} » trop long`);
      }
      const texts = [
        messages.welcome(null),
        messages.welcome('Rasoa'),
        messages.productsHeader(1, 1),
        messages.productsHeader(1, 3),
        messages.onlyInStock(3),
        messages.noted(2, 'Kiraro'),
        messages.howMany('Kiraro', '12 000 Ar'),
        messages.notRecognized(['xyz']),
        messages.receipt('MSG-1', '• 2 × Kiraro', '24 000 Ar'),
        messages.rawSent('MSG-1'),
        ...[messages.noProducts, messages.productUnavailable, messages.emptyCart, messages.cartTitle, messages.total('1 Ar')],
        ...[messages.soldOut, messages.stockShortage, messages.adjusted, messages.allSoldOut, messages.cannotValidate],
        ...[messages.cartCleared, messages.notUnderstood, messages.textOnly, messages.reference],
      ];
      for (const text of texts) {
        assert.ok(text.trim().length > 0);
      }
      assert.match(messages.welcome('Rasoa'), /Rasoa/);
      assert.match(messages.productsHeader(2, 3), /2\/3/);
    });

    it(`${lang} : messages de suivi de commande et de statut`, () => {
      for (const event of NOTIFICATION_EVENTS) {
        const text = notificationText(event, draft, { unavailable: [
          { productName: 'Kiraro', requested: 5, available: 2 },
          { productName: 'Satroka', requested: 1, available: 0 },
        ], note: 'Merci' }, lang);
        assert.match(text, /MSG-20261006-001/);
        assert.match(text, /Merci$/);
      }
      for (const status of CUSTOMER_ORDER_STATUSES) {
        assert.match(statusInquiryText({ ...draft, customerStatus: status }, lang), /MSG-20261006-001 \(24\D000\sAr\)/);
      }
    });
  }
});

describe('quantité seule', () => {
  it('lit chiffres et nombres en lettres, refuse le reste', () => {
    assert.equal(quantityOnly(['3']), 3);
    assert.equal(quantityOnly(['roa', 'ambin', 'ny', 'folo']), 12);
    assert.equal(quantityOnly(['twenty', 'one']), 21);
    assert.equal(quantityOnly(['deux', 'douzaines']), 24);
    assert.equal(quantityOnly(['kiraro']), null);
    assert.equal(quantityOnly(['2', 'kiraro']), null);
  });
});
