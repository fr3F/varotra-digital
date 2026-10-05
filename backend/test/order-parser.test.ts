import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOrderMessage } from '../src/domain/order-parser.ts';
import type { CatalogProduct } from '../src/domain/types.ts';

const catalog: CatalogProduct[] = [
  { id: 'huile', name: 'Huile Tiko 1L', sku: 'HT1', unitPrice: 9500, available: 10 },
  { id: 'savon', name: 'Savon Nosy', sku: null, unitPrice: 1500, available: 20 },
  { id: 'riz', name: 'Riz Makalioka 1kg', sku: null, unitPrice: 4000, available: 0 },
  { id: 'coca', name: 'Coca-Cola 1,5L', sku: null, unitPrice: 6000, available: 5 },
  { id: 'coca-small', name: 'Coca-Cola 33cl', sku: null, unitPrice: 2500, available: 5 },
];

const lines = (text: string) =>
  parseOrderMessage(text, catalog).lines.map((line) => `${line.quantity}×${line.productId}`);

describe('parseOrderMessage', () => {
  it('reconnaît plusieurs articles et leurs quantités (français)', () => {
    assert.deepEqual(lines('Bonjour, je voudrais 2 huile tiko et un savon svp'), ['2×huile', '1×savon']);
  });

  it('comprend le malgache (mila, roa, sy)', () => {
    assert.deepEqual(lines('Mila huile tiko roa sy savon telo azafady'), ['2×huile', '3×savon']);
  });

  it('accepte « x3 », « 3x », la référence et les accents', () => {
    assert.deepEqual(lines('HT1 x3'), ['3×huile']);
    assert.deepEqual(lines('3x Savon NOSY'), ['3×savon']);
    assert.deepEqual(lines('riz makaliokà'), ['1×riz']);
  });

  it('accepte un mot partiel quand un seul produit correspond', () => {
    assert.deepEqual(lines('2 huile'), ['2×huile']);
  });

  it('ne choisit pas entre deux produits ambigus', () => {
    const result = parseOrderMessage('2 coca', catalog);
    assert.deepEqual(result.lines, []);
    assert.deepEqual(result.unmatched, ['2 coca']);
  });

  it('distingue les variantes grâce aux détails (« 33cl »)', () => {
    assert.deepEqual(lines('4 coca 33cl'), ['4×coca-small']);
  });

  it('regroupe un même produit cité deux fois', () => {
    assert.deepEqual(lines('1 savon, 2 savon nosy'), ['3×savon']);
  });

  it('signale ce qui n’est pas compris, sans les formules de politesse', () => {
    const result = parseOrderMessage('1 savon, 2 chaussures, merci', catalog);
    assert.deepEqual(result.lines.map((line) => line.productId), ['savon']);
    assert.deepEqual(result.unmatched, ['2 chaussures']);
  });
});
