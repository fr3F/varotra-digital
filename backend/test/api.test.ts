import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { type AppDeps, buildApp, type CarnetApp, createScheduledJobs } from '../src/app.ts';
import type { AppConfig } from '../src/config.ts';
import { openNodeDatabase } from '../src/db/node-sqlite.ts';
import type { QuickReply } from '../src/domain/types.ts';
import type { FacebookOAuth, FacebookPage } from '../src/messenger/facebook-oauth.ts';
import type { MessengerClient } from '../src/messenger/messenger-client.ts';
import { createTaskQueue } from '../src/messenger/messenger-service.ts';
import { signPayload } from '../src/messenger/signature.ts';
import type { PushClient, PushMessage, PushResult } from '../src/push/push-client.ts';

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
  meta: {
    appSecret: 'secret-de-test',
    verifyToken: 'jeton-verif',
    appId: null,
    pageAccessToken: null,
    graphApiVersion: 'v25.0',
    buttonStyle: 'template',
  },
  pairingCode: 'CODE-1234',
  adminToken: 'admin-jeton-de-test-0123',
  corsOrigins: ['http://localhost:8081'],
  legal: { businessName: 'Boutique <Rasoa>', contactEmail: 'contact@exemple.mg' },
  devTools: false,
};

interface Sent {
  readonly psid: string;
  readonly text: string;
  readonly quickReplies?: readonly QuickReply[];
}

function setup(now: () => Date = () => new Date(), facebook: FacebookOAuth | null = null) {
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
  const pushed: PushMessage[] = [];
  // Réponse simulée d'Expo Push, par jeton (ok par défaut).
  const pushResults = new Map<string, PushResult>();
  const pushClient: PushClient = {
    async send(messages) {
      pushed.push(...messages);
      return messages.map((message) => pushResults.get(message.to) ?? 'ok');
    },
  };
  const queue = createTaskQueue();
  const deps: AppDeps = {
    config,
    db: openNodeDatabase(':memory:'),
    messengerClientFor: () => client,
    facebook,
    pushClient,
    defer: (_c, task) => queue.push(task),
    now,
  };
  const hono = buildApp(deps);
  const app = { inject: (options: InjectOptions) => inject(hono, options) };
  return { app, queue, sent, pushed, pushResults, deps };
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
    // 3 savons demandés pour 2 en stock : pas de « Valider », le client ajuste son panier.
    await postWebhook(ctx.app, webhook('u1', 'm2', { text: 'Ajuster', quick_reply: { payload: 'ADJUST' } }));
    await postWebhook(ctx.app, webhook('u1', 'm3', { text: 'Valider', quick_reply: { payload: 'CHECKOUT' } }));
    await postWebhook(ctx.app, webhook('u1', 'm3-tel', { text: '034 12 345 67' }));
    await postWebhook(ctx.app, webhook('u1', 'm3-adr', { text: 'Analakely, Antananarivo' }));
    await ctx.queue.idle();

    assert.equal(ctx.sent.length, 5, 'panier, panier ajusté, téléphone ?, adresse ?, confirmation');
    assert.match(ctx.sent[0]?.text ?? '', /⚠️ seulement 2 en stock/);
    assert.ok(!ctx.sent[0]?.quickReplies?.some((reply) => reply.payload === 'CHECKOUT'));
    assert.match(ctx.sent[1]?.text ?? '', /2 × Savon Nosy/);
    assert.match(ctx.sent[2]?.text ?? '', /numéro de téléphone/);
    assert.match(ctx.sent[3]?.text ?? '', /Où faut-il livrer/);
    // Dans Antananarivo : frais fixe (3 000 Ar par défaut) ajouté au total.
    assert.match(
      ctx.sent[4]?.text ?? '',
      /Commande reçue ✅ \(réf\. MSG-\d{8}-001\)[\s\S]*📞 034 12 345 67\n📍 Analakely, Antananarivo\n🚚 Livraison \(Antananarivo\) : 3\s000\sAr\nTotal : 25\s000\sAr/,
    );

    const pending = await ctx.app.inject({ url: '/v1/orders/pending', headers: auth });
    const { orders } = pending.json<{ orders: { id: string; needsReview: boolean; customer: { name: string }; items: unknown[] }[] }>();
    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.customer.name, 'Rasoa Be');
    assert.equal(orders[0]?.items.length, 2);
    assert.equal(orders[0]?.needsReview, false, 'panier ajusté au stock');
    assert.deepEqual((orders[0] as unknown as { delivery: unknown }).delivery, {
      phone: '034 12 345 67',
      address: 'Analakely, Antananarivo',
      zone: 'TANA',
      fee: 3000,
    });

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
      // Même horloge que les messages suivants (sinon la conversation serait vue comme oubliée).
      entry: [{ id: 'PAGE', messaging: [{ sender: { id: 'u2' }, timestamp: Date.now(), message: { mid: 'x1', text: 'Valider', quick_reply: { payload: 'PRODUCT:p-huile' } } }] }],
    });
    await postWebhook(ctx.app, body);
    await postWebhook(ctx.app, webhook('u2', 'x2', { text: '1', quick_reply: { payload: 'QTY:1' } }));
    await postWebhook(ctx.app, webhook('u2', 'x3', { text: 'ok', quick_reply: { payload: 'CHECKOUT' } }));
    await postWebhook(ctx.app, webhook('u2', 'x3-tel', { text: '034 12 345 67' }));
    await postWebhook(ctx.app, webhook('u2', 'x3-adr', { text: 'Analakely, Antananarivo' }));
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
    await postWebhook(ctx.app, webhook(psid, `${psid}-2-tel`, { text: '034 12 345 67' }));
    await postWebhook(ctx.app, webhook(psid, `${psid}-2-adr`, { text: 'Analakely, Antananarivo' }));
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
    // Stock vendu entre-temps en boutique : l'application répond « indisponible ».
    const { auth, id } = await orderFrom(ctx, 'c2', '2 savon');
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

  it('message écrit par le vendeur : envoyé tel quel au client, et dans l’historique', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'v1', '1 savon');
    const empty = await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/message`, headers: auth, payload: { text: ' ' } });
    assert.equal(empty.statusCode, 400);

    const text = 'Salama! Ho tonga rahampitso maraina ny entanao.';
    const result = await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/message`, headers: auth, payload: { text } });
    assert.deepEqual(result.json(), { delivered: true, text });
    assert.equal(ctx.sent.at(-1)?.text, text);

    const history = (await ctx.app.inject({ url: `/v1/orders/${id}/replies`, headers: auth })).json<{ replies: { kind: string }[] }>();
    assert.equal(history.replies.at(-1)?.kind, 'MANUAL');

    const unknown = await ctx.app.inject({ method: 'POST', url: '/v1/orders/nope/message', headers: auth, payload: { text } });
    assert.deepEqual(unknown.json(), { delivered: false, reason: 'UNKNOWN_ORDER', text: null });
  });

  it('frais de livraison réglés depuis l’application', async () => {
    const ctx = setup();
    const auth = { authorization: `Bearer ${await pair(ctx.app)}` };
    const refused = await ctx.app.inject({ method: 'PUT', url: '/v1/settings', headers: auth, payload: { deliveryFee: -1 } });
    assert.equal(refused.statusCode, 400);
    const saved = await ctx.app.inject({ method: 'PUT', url: '/v1/settings', headers: auth, payload: { deliveryFee: 4000 } });
    assert.deepEqual(saved.json(), { deliveryFee: 4000 });

    await orderFrom(ctx, 'f1', '1 savon');
    assert.match(ctx.sent.at(-1)?.text ?? '', /🚚 Livraison \(Antananarivo\) : 4\s000\sAr\nTotal : 5\s500\sAr/);
  });

  it('le client demande « statut ? » : réponse avec sa dernière commande', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'c3', '1 huile');
    await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/notify`, headers: auth, payload: { event: 'CONFIRMED' } });
    await postWebhook(ctx.app, webhook('c3', 'c3-3', { text: 'Aiza ny kaomandiko ?' }));
    await ctx.queue.idle();
    // Question en malgache : réponse en malgache.
    assert.match(
      ctx.sent.at(-1)?.text ?? '',
      /^Ny kaomandinao MSG-\d{8}-001 \(9\s500\sAr\) : voamafy ✅\.\n\n1\. 🛒 Kaomandy vaovao\n✍️ Valio amin’ny laharana \(ohatra: 1\)$/,
    );

    await postWebhook(ctx.app, webhook('c3', 'c3-4', { text: 'Où en est ma commande ?' }));
    await ctx.queue.idle();
    assert.match(ctx.sent.at(-1)?.text ?? '', /^Votre commande MSG-\d{8}-001 \(9\s500\sAr\) est confirmée ✅\.\n\n1\. 🛒 Nouvelle commande\n/);

    // Facebook Lite n'affiche pas les boutons : « 1 » vaut un appui sur « Nouvelle commande ».
    await postWebhook(ctx.app, webhook('c3', 'c3-5', { text: '1' }));
    await ctx.queue.idle();
    assert.match(ctx.sent.at(-1)?.text ?? '', /• Huile Tiko 1L/);
  });

  it('prévient le client dans sa langue (malgache)', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'c5', 'Mila huile tiko 1 azafady');
    const result = await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/notify`, headers: auth, payload: { event: 'CONFIRMED' } });
    assert.match(result.json<{ text: string }>().text, /^Voamafy ny kaomandinao\.\nLaharana MSG-\d{8}-001 — Totaly : 9 500 Ar$/);
  });

  it('refuse un événement inconnu', async () => {
    const ctx = setup();
    const { auth, id } = await orderFrom(ctx, 'c4', '1 huile');
    const result = await ctx.app.inject({ method: 'POST', url: `/v1/orders/${id}/notify`, headers: auth, payload: { event: 'PAID' } });
    assert.equal(result.statusCode, 400);
  });
});

describe('relance des paniers abandonnés', () => {
  it('relance une seule fois un panier non validé après 1 h, pas une commande validée', async () => {
    const ctx = setup();
    const auth = { authorization: `Bearer ${await pair(ctx.app)}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: CATALOG });
    await postWebhook(ctx.app, webhook('r1', 'r1-1', { text: 'Salama, mila huile tiko roa' }));
    await postWebhook(ctx.app, webhook('r2', 'r2-1', { text: '1 huile' }));
    await postWebhook(ctx.app, webhook('r2', 'r2-2', { text: 'ok', quick_reply: { payload: 'CHECKOUT' } }));
    await postWebhook(ctx.app, webhook('r2', 'r2-2-tel', { text: '034 12 345 67' }));
    await postWebhook(ctx.app, webhook('r2', 'r2-2-adr', { text: 'Analakely, Antananarivo' }));
    await ctx.queue.idle();
    const before = ctx.sent.length;

    const at = (hours: number) => createScheduledJobs({ ...ctx.deps, now: () => new Date(Date.now() + hours * 3600_000) });
    await at(0.5).run();
    assert.equal(ctx.sent.length, before, 'pas avant 1 h');

    await at(2).run();
    assert.equal(ctx.sent.length, before + 1, 'un seul client relancé (r1)');
    assert.equal(ctx.sent.at(-1)?.psid, 'r1');
    assert.match(ctx.sent.at(-1)?.text ?? '', /^Mbola miandry anao ny haronao 🛒/);

    await at(3).run();
    assert.equal(ctx.sent.length, before + 1, 'jamais deux relances pour le même panier');
  });

  it('met en avant (⭐) les produits les plus commandés', async () => {
    const ctx = setup();
    const auth = { authorization: `Bearer ${await pair(ctx.app)}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: CATALOG });
    await postWebhook(ctx.app, webhook('p1', 'p1-1', { text: '2 savon' }));
    await postWebhook(ctx.app, webhook('p1', 'p1-2', { text: 'ok', quick_reply: { payload: 'CHECKOUT' } }));
    await postWebhook(ctx.app, webhook('p1', 'p1-2-tel', { text: '034 12 345 67' }));
    await postWebhook(ctx.app, webhook('p1', 'p1-2-adr', { text: 'Analakely, Antananarivo' }));
    await postWebhook(ctx.app, webhook('p2', 'p2-1', { text: 'menu' }));
    await ctx.queue.idle();
    assert.match(ctx.sent.at(-1)?.text ?? '', /• Savon Nosy — 1\D500\sAr ⭐ 🔥 plus que 2\n• Huile/);
  });
});

describe('notifications push (nouvelle commande)', () => {
  const PUSH_TOKEN = 'ExponentPushToken[AbCdEf123456789]';

  async function order(ctx: ReturnType<typeof setup>, psid: string): Promise<void> {
    await postWebhook(ctx.app, webhook(psid, `${psid}-1`, { text: '2 huile tiko' }));
    await postWebhook(ctx.app, webhook(psid, `${psid}-2`, { text: 'Valider', quick_reply: { payload: 'CHECKOUT' } }));
    await postWebhook(ctx.app, webhook(psid, `${psid}-2-tel`, { text: '034 12 345 67' }));
    await postWebhook(ctx.app, webhook(psid, `${psid}-2-adr`, { text: 'Analakely, Antananarivo' }));
    await ctx.queue.idle();
  }

  it('prévient le téléphone relié dès qu’une commande arrive', async () => {
    const ctx = setup();
    const auth = { authorization: `Bearer ${await pair(ctx.app)}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: CATALOG });

    await order(ctx, 'u1');
    assert.equal(ctx.pushed.length, 0, 'aucun jeton enregistré : pas de push');

    const saved = await ctx.app.inject({ method: 'PUT', url: '/v1/devices/push-token', headers: auth, payload: { pushToken: PUSH_TOKEN } });
    assert.deepEqual(saved.json(), { ok: true, push: true });
    await order(ctx, 'u2');

    assert.equal(ctx.pushed.length, 1);
    const push = ctx.pushed[0];
    assert.equal(push?.to, PUSH_TOKEN);
    assert.equal(push?.channelId, 'orders-new');
    assert.match(push?.title ?? '', /^Nouvelle commande MSG-\d{8}-002 · Rasoa Be$/);
    assert.match(push?.body ?? '', /^2 × Huile Tiko 1L · 19\D?000\sAr$/u);
    assert.equal(push?.data['screen'], 'messenger-order');
  });

  it('refuse un jeton invalide et oublie un jeton désinscrit', async () => {
    const ctx = setup();
    const auth = { authorization: `Bearer ${await pair(ctx.app)}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: auth, payload: CATALOG });

    const bad = await ctx.app.inject({ method: 'PUT', url: '/v1/devices/push-token', headers: auth, payload: { pushToken: 'n importe quoi' } });
    assert.equal(bad.statusCode, 400);

    await ctx.app.inject({ method: 'PUT', url: '/v1/devices/push-token', headers: auth, payload: { pushToken: PUSH_TOKEN } });
    ctx.pushResults.set(PUSH_TOKEN, 'unregistered');
    await order(ctx, 'u1');
    await order(ctx, 'u2');
    assert.equal(ctx.pushed.length, 1, 'jeton oublié après « DeviceNotRegistered »');
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

describe('plusieurs boutiques (une Page Facebook chacune)', () => {
  const ADMIN = { authorization: 'Bearer admin-jeton-de-test-0123' };
  const PAGE_B: FacebookPage = { id: 'PAGE-B', name: 'Rakoto Shop', accessToken: 'jeton-page-b' };

  /** Facebook simulé : le vendeur administre la Page B. */
  function fakeFacebook(subscribed: string[]): FacebookOAuth {
    return {
      loginUrl: (redirectUri, state) => `https://facebook.test/dialog?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
      async exchangeCode(code) {
        assert.equal(code, 'code-fb');
        return 'jeton-utilisateur';
      },
      async listPages() {
        return [PAGE_B];
      },
      async subscribePage(page) {
        subscribed.push(page.id);
      },
    };
  }

  function webhookFor(pageId: string, psid: string, mid: string, text: string) {
    return JSON.stringify({
      object: 'page',
      entry: [{ id: pageId, messaging: [{ sender: { id: psid }, recipient: { id: pageId }, timestamp: Date.now(), message: { mid, text } }] }],
    });
  }

  /** Crée la boutique B (admin), relie un téléphone avec son code, puis sa Page via Facebook. */
  async function shopB(ctx: ReturnType<typeof setup>) {
    const created = await ctx.app.inject({ method: 'POST', url: '/admin/api/shops', headers: ADMIN, payload: { name: 'Client Rakoto', months: 1 } });
    assert.equal(created.statusCode, 201);
    const code = created.json<{ shop: { id: string; activationCode: string } }>().shop;
    assert.match(code.activationCode, /^KD-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const paired = await ctx.app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      // Saisie approximative : minuscules et sans tirets.
      payload: { pairingCode: code.activationCode.toLowerCase().replace(/-/g, ''), deviceName: 'Finday Rakoto' },
    });
    assert.equal(paired.statusCode, 201);
    const auth = { authorization: `Bearer ${paired.json<{ token: string }>().token}` };
    assert.equal((await ctx.app.inject({ url: '/v1/shop', headers: auth })).json<{ pageLinked: boolean }>().pageLinked, false);

    const { url } = (await ctx.app.inject({ method: 'POST', url: '/v1/facebook/connect', headers: auth })).json<{ url: string }>();
    const state = new URL(url).searchParams.get('state') ?? '';
    const choose = await ctx.app.inject({ url: `/connect/facebook/callback?code=code-fb&state=${state}` });
    assert.match(choose.body, /Rakoto Shop/);
    const linked = await ctx.app.inject({
      method: 'POST',
      url: '/connect/facebook/page',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ state, pageId: PAGE_B.id }).toString(),
    });
    assert.match(linked.body, /carnetdigital:\/\/messenger/);
    return { id: code.id, auth };
  }

  it('chaque boutique a sa Page, son catalogue et ses commandes', async () => {
    const subscribed: string[] = [];
    const ctx = setup(undefined, fakeFacebook(subscribed));
    const defaultAuth = { authorization: `Bearer ${await pair(ctx.app)}` };
    await ctx.app.inject({ method: 'PUT', url: '/v1/catalog', headers: defaultAuth, payload: CATALOG });
    const b = await shopB(ctx);
    assert.deepEqual(subscribed, ['PAGE-B']);
    const shop = (await ctx.app.inject({ url: '/v1/shop', headers: b.auth })).json<{ name: string; pageName: string; active: boolean }>();
    assert.equal(shop.pageName, 'Rakoto Shop');
    // La boutique prend le nom de la Page choisie (et non celui saisi à la création).
    assert.equal(shop.name, 'Rakoto Shop');
    assert.equal(shop.active, true);

    await ctx.app.inject({
      method: 'PUT',
      url: '/v1/catalog',
      headers: b.auth,
      payload: { products: [{ id: 'kiraro', name: 'Kiraro mainty', sku: null, unitPrice: 25000, available: 4 }] },
    });
    // Un client écrit à la Page B : le bot ne propose que le catalogue de B.
    await postWebhook(ctx.app, webhookFor('PAGE-B', 'client-b', 'b1', 'salama'));
    await ctx.queue.idle();
    assert.match(ctx.sent.at(-1)?.text ?? '', /Kiraro mainty/);
    assert.doesNotMatch(ctx.sent.at(-1)?.text ?? '', /Huile/);

    for (const [mid, text] of [['b2', '2 kiraro'], ['b3', 'eny'], ['b4', '0341234567'], ['b5', 'Isotry']] as const) {
      await postWebhook(ctx.app, webhookFor('PAGE-B', 'client-b', mid, text));
    }
    await ctx.queue.idle();
    const pendingB = (await ctx.app.inject({ url: '/v1/orders/pending', headers: b.auth })).json<{ orders: { reference: string }[] }>();
    assert.equal(pendingB.orders.length, 1);
    // La boutique « default » ne voit pas la commande de B, et les références repartent de 001 par boutique.
    assert.deepEqual((await ctx.app.inject({ url: '/v1/orders/pending', headers: defaultAuth })).json(), { orders: [] });
    assert.match(pendingB.orders[0]?.reference ?? '', /-001$/);
  });

  it('abonnement fini ou suspendu : le bot se tait et l’application est bloquée', async () => {
    const ctx = setup(undefined, fakeFacebook([]));
    const b = await shopB(ctx);
    const suspended = await ctx.app.inject({ method: 'POST', url: `/admin/api/shops/${b.id}/suspend`, headers: ADMIN, payload: { suspended: true } });
    assert.equal(suspended.json<{ shop: { active: boolean } }>().shop.active, false);

    assert.equal((await ctx.app.inject({ url: '/v1/orders/pending', headers: b.auth })).statusCode, 402);
    // L'application peut encore afficher l'état de la boutique.
    assert.equal((await ctx.app.inject({ url: '/v1/shop', headers: b.auth })).json<{ active: boolean }>().active, false);
    const before = ctx.sent.length;
    await postWebhook(ctx.app, webhookFor('PAGE-B', 'client-b', 's1', 'salama'));
    await ctx.queue.idle();
    assert.equal(ctx.sent.length, before);

    const extended = await ctx.app.inject({ method: 'POST', url: `/admin/api/shops/${b.id}/suspend`, headers: ADMIN, payload: { suspended: false } });
    assert.equal(extended.json<{ shop: { active: boolean } }>().shop.active, true);
    assert.equal((await ctx.app.inject({ url: '/v1/orders/pending', headers: b.auth })).statusCode, 200);
  });

  it('prolonger : un mois de plus à partir de la fin actuelle', async () => {
    const ctx = setup(() => new Date('2026-10-07T10:00:00Z'));
    const created = await ctx.app.inject({ method: 'POST', url: '/admin/api/shops', headers: ADMIN, payload: { name: 'Shop', months: 1 } });
    const { id, expiresAt } = created.json<{ shop: { id: string; expiresAt: string } }>().shop;
    assert.equal(expiresAt, '2026-11-07T10:00:00.000Z');
    const extended = await ctx.app.inject({ method: 'POST', url: `/admin/api/shops/${id}/extend`, headers: ADMIN, payload: { months: 3 } });
    assert.equal(extended.json<{ shop: { expiresAt: string } }>().shop.expiresAt, '2027-02-07T10:00:00.000Z');
  });

  it('administration protégée et codes refusés', async () => {
    const ctx = setup();
    assert.equal((await ctx.app.inject({ url: '/admin/api/shops', headers: { authorization: 'Bearer faux' } })).statusCode, 401);
    const wrong = await ctx.app.inject({ method: 'POST', url: '/v1/devices/pair', payload: { pairingCode: 'KD-AAAA-BBBB', deviceName: 'x' } });
    assert.equal(wrong.statusCode, 403);
    // Sans META_APP_ID : pas de connexion Facebook.
    const auth = { authorization: `Bearer ${await pair(ctx.app)}` };
    assert.equal((await ctx.app.inject({ method: 'POST', url: '/v1/facebook/connect', headers: auth })).statusCode, 503);
  });

  it('une Page déjà reliée à une boutique ne peut pas l’être à une autre', async () => {
    const ctx = setup(undefined, fakeFacebook([]));
    await shopB(ctx);
    const created = await ctx.app.inject({ method: 'POST', url: '/admin/api/shops', headers: ADMIN, payload: { name: 'Autre', months: 1 } });
    const paired = await ctx.app.inject({
      method: 'POST',
      url: '/v1/devices/pair',
      payload: { pairingCode: created.json<{ shop: { activationCode: string } }>().shop.activationCode, deviceName: 'x' },
    });
    const auth = { authorization: `Bearer ${paired.json<{ token: string }>().token}` };
    const { url } = (await ctx.app.inject({ method: 'POST', url: '/v1/facebook/connect', headers: auth })).json<{ url: string }>();
    const state = new URL(url).searchParams.get('state') ?? '';
    await ctx.app.inject({ url: `/connect/facebook/callback?code=code-fb&state=${state}` });
    const refused = await ctx.app.inject({
      method: 'POST',
      url: '/connect/facebook/page',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ state, pageId: PAGE_B.id }).toString(),
    });
    assert.equal(refused.statusCode, 409);
    assert.match(refused.body, /déjà reliée/);
  });
});

