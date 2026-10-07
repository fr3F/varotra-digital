import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deliveryZone, normalizePhone } from '../src/domain/delivery.ts';

describe('livraison : téléphone et zone', () => {
  it('reconnaît les numéros malgaches, écrits de plusieurs façons', () => {
    for (const written of ['0341234567', '034 12 345 67', '034-12-345-67', '+261 34 12 345 67', '261341234567']) {
      assert.equal(normalizePhone(written), '034 12 345 67', written);
    }
    assert.equal(normalizePhone('032 98 765 43'), '032 98 765 43');
  });

  it('refuse ce qui n’est pas un numéro de mobile', () => {
    for (const written of ['12345', '020 22 123 45', '034 12 345', 'Analakely', '']) {
      assert.equal(normalizePhone(written), null, written);
    }
  });

  it('Antananarivo ville : nom de la ville ou quartier connu', () => {
    for (const address of ['Analakely', 'Lot IVG 45 Ankorondrano', 'tana', 'Antananarivo', '67 ha atsimo', 'Isotry, Tananarive']) {
      assert.equal(deliveryZone(address), 'TANA', address);
    }
  });

  it('hors de la ville ou lieu inconnu : frais à convenir', () => {
    for (const address of ['Ivato', 'Ambohimangakely', 'Itaosy Antananarivo', 'Toamasina', 'Antsirabe centre', 'Lot 12 Ambohibe']) {
      assert.equal(deliveryZone(address), 'OTHER', address);
    }
  });
});
