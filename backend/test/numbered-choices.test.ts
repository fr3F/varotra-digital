import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { choiceFromText, choicesOf, numberedChoices, withNumberedChoices } from '../src/domain/numbered-choices.ts';

const choices = [
  { title: 'Kiraro mainty', payload: 'PRODUCT:a' },
  { title: '🛒 Hijery entana', payload: 'MENU' },
];

describe('choix numérotés (Facebook Lite)', () => {
  it('écrit les choix numérotés et la consigne sous le texte', () => {
    assert.deepEqual(withNumberedChoices({ text: 'Inona no tianao ?', quickReplies: choices }, 'mg'), {
      text: 'Inona no tianao ?\n\n1. Kiraro mainty\n2. 🛒 Hijery entana\n✍️ Valio amin’ny laharana (ohatra: 1)',
      quickReplies: choices,
    });
  });

  it('sans bouton : texte inchangé', () => {
    assert.deepEqual(withNumberedChoices({ text: 'Misaotra' }, 'mg'), { text: 'Misaotra' });
  });

  it('choix de quantité (boutons déjà numériques) : pas de numéros', () => {
    const quantities = [1, 2, 3].map((n) => ({ title: String(n), payload: `QTY:${n}` }));
    assert.deepEqual(numberedChoices([...quantities, { title: 'Menu', payload: 'MENU' }]), []);
    assert.equal(withNumberedChoices({ text: 'Firy ?', quickReplies: quantities }, 'fr').text, 'Firy ?');
  });

  it('retrouve le choix tapé par son numéro', () => {
    assert.equal(choiceFromText('2', choices), 'MENU');
    assert.equal(choiceFromText(' 1. ', choices), 'PRODUCT:a');
    assert.equal(choiceFromText('3', choices), null);
    assert.equal(choiceFromText('0', choices), null);
    assert.equal(choiceFromText('2 kiraro', choices), null);
    assert.equal(choiceFromText('1', []), null);
  });

  it('garde les choix de la dernière réponse qui en a', () => {
    assert.deepEqual(choicesOf([{ text: 'a', quickReplies: choices }, { text: 'b' }]), choices);
    assert.deepEqual(choicesOf([{ text: 'b' }]), []);
  });
});
