import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { buildApp, type CarnetApp } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { openNodeDatabase } from '../src/db/node-sqlite.ts';
import { createRepositories } from '../src/db/repositories.ts';
import type { QuickReply } from '../src/domain/types.ts';
import type { MessengerClient } from '../src/messenger/messenger-client.ts';
import { createTaskQueue } from '../src/messenger/messenger-service.ts';
import { signPayload } from '../src/messenger/signature.ts';

interface InjectOptions {
  readonly method?: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly payload?: string | object;
}

interface InjectResponse {
  readonly statusCode: number;
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  json<T = unknown>(): T;
}

/** Requête HTTP simulée sur l'application Hono (sans réseau). */
async function inject(app: CarnetApp, options: InjectOptions): Promise<InjectResponse> {
  const headers = new Headers(options.headers);
  let body: string | undefined;
  if (options.payload !== undefined) {
    body = typeof options.payload === 'string' ? options.payload : JSON.stringify(options.payload);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }
  const response = await app.request(options.url, { method: options.method ?? 'GET', headers, body });
  const text = await response.text();
  return {
    statusCode: response.status,
    body: text,
    headers: Object.fromEntries(response.headers.entries()),
    json: <T,>() => JSON.parse(text) as T,
  };
}

const config: AppConfig = {
  port: 0,
  host: '127.0.0.1',
  databasePath: ':memory:',
  meta: { appSecret: 'secret-de-test', verifyToken: 'jeton-verif', pageAccessToken: null, graphApiVersion: 'v25.0' },
  pairingCode: 'CODE-1234',
  corsOrigins: ['http://localhost:8081'],
  legal: { businessName: 'Boutique <Rasoa>', contactEmail: 'contact@exemple.mg' },
  devTools: false,
};

interface Sent {
  readonly psid: string;
  readonly text: string;
  readonly quickReplies?: readonly QuickReply[];
}

function setup(now: () => Date = () => new Date()) {
  const sent: Sent[] = [];
  const client: MessengerClient = {
    live: true,
    async sendText(psid, text, quickReplies) {
      sent.push({ psid, text, quickReplies });
    },
    async getCustomerName() {
      return 'Rasoa Be';
    },
  };
  const queue = createTaskQueue();
  const hono = buildApp({
    config,
    repos: createRepositories(openNodeDatabase(':memory:')),
    messengerClient: client,
    defer: (_c, task) => queue.push(task),
    now,
  });
  const app = { inject: (options: InjectOptions) => inject(hono, options) };
  return { app, queue, sent };
}

function webhook(psid: string, mid: string, message: Record<string, unknown>) {
  return JSON.stringify({
    object: 'page',
    entry: [{ id: 'PAGE', time: Date.now(), messaging: [{ sender: { id: psid }, recipient: { id: 'PAGE' }, timestamp: Date.now(), message: { mid, ...message } }] }],
  });
}

type App = ReturnType<typeof setup>['app'];

async function postWebhook(app: App, body: string, signature = signPayload(body, config.meta.appSecret)) {
  return app.inject({
    method: 'POST',
    url: '/webhooks/messenger',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
    payload: body,
  });
}

async function pair(app: App): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/devices/pair',
    payload: { pairingCode: 'CODE-1234', deviceName: 'Téléphone de test' },
  });
  assert.equal(response.statusCode, 201);
  const body: unknown = response.json();
  assert.ok(typeof body === 'object' && body !== null && 'token' in body && typeof body.token === 'string');
  return body.token;
}

const CATALOG = {
  products: [
    { id: 'p-huile', name: 'Huile Tiko 1L', sku: null, unitPrice: 9500, available: 10 },
    { id: 'p-savon', name: 'Savon Nosy', sku: 'SN', unitPrice: 1500, available: 2 },
  ],
};

describe('webhook Meta', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('répond au défi de vérification avec le bon jeton seulement', async () => {
    const ok = await ctx.app.inject({ url: '/webhooks/messenger?hub.mode=subscribe&hub.verify_token=jeton-verif&hub.challenge=42' });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body, '42');
    const ko = await ctx.app.inject({ url: '/webhooks/messenger?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=42' });
    assert.equal(ko.statusCode, 403);
  });

  it('refuse un webhook mal signé', async () => {
    const response = await postWebhook(ctx.app, webhook('u1', 'm1', { text: 'menu' }), 'sha256=00');
    assert.equal(response.statusCode, 401);
  });

  it('message -> commande -> récupération par l’application -> accusé -> client prévenu', async () => {
    const token = await pair(ctx.app);
    const auth = { authorization: `Bearer ${token}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: CATALOG });

    assert.equal((await postWebhook(ctx.app, webhook('u1', 'm1', { text: '2 huile tiko et 3 savon' }))).statusCode, 200);
    // Renvoi du même webhook par Meta : ignoré.
    await postWebhook(ctx.app, webhook('u1', 'm1', { text: '2 huile tiko et 3 savon' }));
    await postWebhook(ctx.app, webhook('u1', 'm2', { text: 'Valider', quick_reply: { payload: 'CHECKOUT' } }));
    await ctx.queue.idle();

    assert.equal(ctx.sent.length, 2, 'panier puis confirmation');
    assert.match(ctx.sent[0]?.text ?? '', /⚠️ stock : 2/);
    assert.match(ctx.sent[1]?.text ?? '', /Commande reçue ✅ \(réf\. MSG-\d{8}-001\)/);

    const pending = await ctx.app.inject({ url: '/v1/orders/pending', headers: auth });
    const { orders } = pending.json<{ orders: { id: string; needsReview: boolean; customer: { name: string }; items: unknown[] }[] }>();
    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.customer.name, 'Rasoa Be');
    assert.equal(orders[0]?.items.length, 2);
    assert.equal(orders[0]?.needsReview, true, '3 savons demandés pour 2 disponibles');

    const id = orders[0]?.id ?? '';
    const ack = await ctx.app.inject({ method: 'POST', url: '/v1/orders/ack', headers: auth, payload: { ids: [id] } });
    assert.deepEqual(ack.json(), { acknowledged: 1 });
    assert.deepEqual((await ctx.app.inject({ url: '/v1/orders/pending', headers: auth })).json(), { orders: [] });

    const status = await ctx.app.inject({
      method: 'POST',
      url: `/v1/orders/${id}/notify`,
      headers: auth,
      payload: { event: 'DELIVERED', note: 'Merci Rasoa !' },
    });
    assert.equal(status.json<{ delivered: boolean }>().delivered, true);
    assert.match(ctx.sent.at(-1)?.text ?? '', /a été livrée\. Merci pour votre confiance 🙏\nMerci Rasoa !/);
  });

  it('hors de la fenêtre de 24 h, le client n’est pas relancé', async () => {
    let clock = new Date('2026-10-04T08:00:00Z');
    ctx = setup(() => clock);
    const token = await pair(ctx.app);
    const auth = { authorization: `Bearer ${token}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: CATALOG });
    const body = JSON.stringify({
      object: 'page',
      entry: [{ messaging: [{ sender: { id: 'u2' }, timestamp: clock.getTime(), message: { mid: 'x1', text: 'Valider', quick_reply: { payload: 'PRODUCT:p-huile' } } }] }],
    });
    await postWebhook(ctx.app, body);
    await postWebhook(ctx.app, webhook('u2', 'x2', { text: '1', quick_reply: { payload: 'QTY:1' } }));
    await postWebhook(ctx.app, webhook('u2', 'x3', { text: 'ok', quick_reply: { payload: 'CHECKOUT' } }));
    await ctx.queue.idle();
    const { orders } = (await ctx.app.inject({ url: '/v1/orders/pending', headers: auth })).json<{ orders: { id: string }[] }>();

    clock = new Date(Date.now() + 25 * 60 * 60 * 1000);
    const draftId = orders[0]?.id ?? '';
    const status = await ctx.app.inject({
      method: 'POST',
      url: `/v1/orders/${draftId}/notify`,
      headers: auth,
      payload: { event: 'DELIVERED' },
    });
    assert.equal(status.json<{ reason: string }>().reason, 'OUTSIDE_WINDOW');
    // Non envoyé, mais tracé dans l'historique des réponses.
    const history = (await ctx.app.inject({ url: `/v1/orders/${draftId}/replies`, headers: auth })).json<{
      customerStatus: string;
      replies: { kind: string; status: string }[];
    }>();
    assert.equal(history.customerStatus, 'DELIVERED');
    assert.equal(history.replies.at(-1)?.kind, 'DELIVERED');
    assert.equal(history.replies.at(-1)?.status, 'OUTSIDE_WINDOW');
  });
});

describe('réponse automatique Facebook', () => {
  async function orderFrom(ctx: ReturnType<typeof setup>, psid: string, text: string) {
    const token = await pair(ctx.app);
    const auth = { authorization: `Bearer ${token}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: CATALOG });
    await postWebhook(ctx.app, webhook(psid, `${psid}-1`, { text }));
    await postWebhook(ctx.app, webhook(psid, `${psid}-2`, { text: 'ok', quick_reply: { payload: 'CHECKOUT' } }));
    await ctx.queue.idle();
    const pending = (await ctx.app.inject({ url: '/v1/orders/pending', headers: auth })).json<{ orders: { id: string }[] }>();
    return { auth, id: pending.orders[0]?.id ?? '' };
  }

  it('stock disponible : « Votre commande est confirmée. »', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'c1', '2 huile tiko');
    const result = await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/notify`, headers: auth, payload: { event: 'CONFIRMED' } });
    const body = result.json<{ delivered: boolean; text: string }>();
    assert.equal(body.delivered, true);
    assert.match(body.text, /^Votre commande est confirmée\.\nRéf\. MSG-\d{8}-001 — Total : 19 000 Ar$/);
    assert.equal(ctx.sent.at(-1)?.text, body.text);
  });

  it('stock insuffisant : « Produit indisponible actuellement. » avec le détail', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'c2', '5 savon');
    const result = await ctx.app.inject({
      method: 'POST',
      url: `/v1/orders/${id}/notify`,
      headers: auth,
      payload: { event: 'UNAVAILABLE', unavailable: [{ productName: 'Savon Nosy', requested: 5, available: 2 }] },
    });
    assert.match(result.json<{ text: string }>().text, /^Produit indisponible actuellement\.\n• Savon Nosy : 2 disponible\(s\) sur 5 demandé\(s\)/);

    const history = (await ctx.app.inject({ url: `/v1/orders/${id}/replies`, headers: auth })).json<{
      customerStatus: string;
      replies: { kind: string; status: string }[];
    }>();
    assert.equal(history.customerStatus, 'UNAVAILABLE');
    assert.deepEqual(
      history.replies.map((reply) => `${reply.kind}:${reply.status}`),
      ['RECEIPT:SENT', 'UNAVAILABLE:SENT'],
    );
  });

  it('le client demande « statut ? » : réponse avec sa dernière commande', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'c3', '1 huile');
    await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/notify`, headers: auth, payload: { event: 'CONFIRMED' } });
    await postWebhook(ctx.app, webhook('c3', 'c3-3', { text: 'Aiza ny kaomandiko ?' }));
    await ctx.queue.idle();
    assert.match(ctx.sent.at(-1)?.text ?? '', /^Votre commande MSG-\d{8}-001 \(9 500 Ar\) est confirmée ✅\.$/);
  });

  it('refuse un événement inconnu', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'c4', '1 huile');
    const result = await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/notify`, headers: auth, payload: { event: 'PAID' } });
    assert.equal(result.statusCode, 400);
  });
});

describe('API de l’application', () => {
  it('exige un jeton valide et limite les essais de code d’appairage', async () => {
    const { app } = setup();
    assert.equal((await app.inject({ url: '/v1/orders/pending' })).statusCode, 401);
    assert.equal((await app.inject({ url: '/v1/orders/pending', headers: { authorization: 'Bearer faux' } })).statusCode, 401);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await app.inject({ method: 'POST', url: '/v1/devices/pair', payload: { pairingCode: 'mauvais', deviceName: 'x' } });
      assert.equal(wrong.statusCode, 403);
    }
    const blocked = await app.inject({ method: 'POST', url: '/v1/devices/pair', payload: { pairingCode: 'CODE-1234', deviceName: 'x' } });
    assert.equal(blocked.statusCode, 429);
  });

  it('refuse un catalogue invalide et révoque un appareil déconnecté', async () => {
    const { app } = setup();
    const token = await pair(app);
    const auth = { authorization: `Bearer ${token}` };
    const invalid = await app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: { products: [{ id: 'x' }] } });
    assert.equal(invalid.statusCode, 400);
    await app.inject({ method: 'POST', url: '/v1/devices/unpair', headers: auth, payload: {} });
    assert.equal((await app.inject({ url: '/v1/orders/pending', headers: auth })).statusCode, 401);
  });

  it('publie les pages exigées par Meta (confidentialité, suppression des données)', async () => {
    const { app } = setup();
    const privacy = await app.inject({ url: '/privacy' });
    assert.equal(privacy.statusCode, 200);
    assert.match(String(privacy.headers['content-type'] ?? ''), /text\/html/);
    assert.match(privacy.body, /Boutique &lt;Rasoa&gt;/, 'nom échappé');
    assert.match(privacy.body, /mailto:contact@exemple\.mg/);
    const deletion = await app.inject({ url: '/data-deletion' });
    assert.equal(deletion.statusCode, 200);
    assert.match(deletion.body, /Suppression de vos données/);
  });

  it('autorise l’application web déclarée (CORS)', async () => {
    const { app } = setup();
    const response = await app.inject({ method: 'OPTIONS', url: '/v1/orders/pending', headers: { origin: 'http://localhost:8081' } });
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:8081');
  });
});
