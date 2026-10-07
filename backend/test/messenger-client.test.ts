import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMessages, createGraphMessengerClient } from '../src/messenger/messenger-client.ts';

const buttons = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `B${i + 1}`, payload: `P${i + 1}` }));

describe('boutons Messenger (Facebook Lite)', () => {
  it('sans bouton : un simple texte', () => {
    assert.deepEqual(buildMessages('Bonjour', [], 'template'), [{ text: 'Bonjour' }]);
  });

  it('modèle « bouton » : boutons dans la bulle, par groupes de 3', () => {
    const messages = buildMessages('Votre panier', buttons(5), 'template');
    assert.equal(messages.length, 2);
    assert.deepEqual(messages[0], {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'Votre panier',
          buttons: [
            { type: 'postback', title: 'B1', payload: 'P1' },
            { type: 'postback', title: 'B2', payload: 'P2' },
            { type: 'postback', title: 'B3', payload: 'P3' },
          ],
        },
      },
    });
    assert.equal(JSON.stringify(messages[1]).includes('"payload":"P5"'), true);
  });

  it('texte trop long pour le modèle : envoyé seul d’abord', () => {
    const long = 'x'.repeat(700);
    const messages = buildMessages(long, buttons(2), 'template');
    assert.deepEqual(messages[0], { text: long });
    assert.equal(messages.length, 2);
  });

  it('texte d’abord (lisible sur Facebook Lite), puis les boutons dans une bulle à part', () => {
    assert.deepEqual(buildMessages('Choix\n1. B1\n2. B2', buttons(2), 'text_first'), [
      { text: 'Choix\n1. B1\n2. B2' },
      {
        text: '👇',
        quick_replies: [
          { content_type: 'text', title: 'B1', payload: 'P1' },
          { content_type: 'text', title: 'B2', payload: 'P2' },
        ],
      },
    ]);
  });

  it('réponses rapides si choisi', () => {
    const [message] = buildMessages('Choix', buttons(2), 'quick_replies');
    assert.deepEqual(message, {
      text: 'Choix',
      quick_replies: [
        { content_type: 'text', title: 'B1', payload: 'P1' },
        { content_type: 'text', title: 'B2', payload: 'P2' },
      ],
    });
  });

  it('envoie chaque bulle à l’API Send dans l’ordre', async () => {
    const bodies: unknown[] = [];
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ message_id: 'm' }), { status: 200 });
    }) as typeof fetch;
    const client = createGraphMessengerClient('TOKEN', 'v25.0', { buttonStyle: 'template', fetchImpl });
    await client.sendText('u1', 'Menu', buttons(4));
    assert.equal(bodies.length, 2);
    assert.match(JSON.stringify(bodies[0]), /"recipient":\{"id":"u1"\}.*"template_type":"button"/);
  });
});
