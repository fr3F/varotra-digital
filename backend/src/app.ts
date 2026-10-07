import { timingSafeEqual } from 'node:crypto';
import { type Context, Hono } from 'hono';
import { ADMIN_HTML } from './api/admin-page.ts';
import { choosePageHtml, connectedHtml, errorHtml } from './api/connect-pages.ts';
import { dataDeletionHtml, privacyPolicyHtml } from './api/legal-pages.ts';
import {
  BadRequestError,
  parseAck,
  parseCatalog,
  parseCreateShop,
  parseExtendShop,
  parseManualMessage,
  parseNotifyRequest,
  parsePairRequest,
  parseSettings,
  parsePushTokenRequest,
  parseSuspendShop,
} from './api/validation.ts';
import type { AppConfig } from './config.ts';
import { createRepositories, type Repositories } from './db/repositories.ts';
import { createShopRepository, PageAlreadyLinkedError } from './db/shops.ts';
import type { SqlDb } from './db/sql.ts';
import { DEFAULT_SHOP_ID, isShopActive, type Shop } from './domain/shop.ts';
import type { OrderDraft } from './domain/types.ts';
import { createCartReminderService } from './messenger/cart-reminder.service.ts';
import { createFacebookNotificationService } from './messenger/facebook-notification.service.ts';
import { createFacebookOAuth, type FacebookOAuth, FacebookOAuthError } from './messenger/facebook-oauth.ts';
import {
  createGraphMessengerClient,
  createSimulatedMessengerClient,
  type MessengerClient,
} from './messenger/messenger-client.ts';
import { createMessengerService } from './messenger/messenger-service.ts';
import { isValidSignature } from './messenger/signature.ts';
import { type MessengerEvent, parseWebhookBody } from './messenger/webhook-events.ts';
import { createOrderPushService } from './push/order-push.service.ts';
import { createExpoPushClient, type PushClient } from './push/push-client.ts';

const API_VERSION = '1';
const PAIRING_MAX_FAILURES = 5;
const PAIRING_WINDOW_MS = 10 * 60 * 1000;

type Env = { Variables: { deviceId: string; shop: ShopContext } };

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export interface AppDeps {
  readonly config: AppConfig;
  readonly db: SqlDb;
  /** Client Messenger d'une boutique (par défaut : API Graph avec le jeton de sa Page, sinon simulation). */
  readonly messengerClientFor?: (shop: Shop) => MessengerClient;
  /** Connexion Facebook du vendeur (par défaut : OAuth Meta si META_APP_ID est configuré). */
  readonly facebook?: FacebookOAuth | null;
  /** Notifications push vers le téléphone du vendeur (Expo Push par défaut). */
  readonly pushClient?: PushClient;
  /**
   * Lance un traitement après la réponse HTTP (Meta exige une réponse en moins de 5 s) :
   * `waitUntil` sur Cloudflare Workers, file d'attente sur Node et dans les tests.
   */
  readonly defer: (c: Context, task: () => Promise<void>) => void;
  readonly logger?: Logger;
  readonly now?: () => Date;
}

/** Services d'une boutique : données, client Messenger, notifications, bot. */
export interface ShopContext {
  readonly shop: Shop;
  readonly repos: Repositories;
  readonly notifications: ReturnType<typeof createFacebookNotificationService>;
  readonly service: ReturnType<typeof createMessengerService>;
}

function defaultLogger(deps: AppDeps): Logger {
  return deps.logger ?? { info: () => undefined, error: (message) => console.error(message) };
}

/** Client Messenger réel si la boutique a un jeton de Page (ou, pour « default », celui des secrets). */
function defaultClientFor(config: AppConfig) {
  return (shop: Shop): MessengerClient => {
    const token = shop.pageAccessToken ?? (shop.id === DEFAULT_SHOP_ID ? config.meta.pageAccessToken : null);
    return token === null
      ? createSimulatedMessengerClient()
      : createGraphMessengerClient(token, config.meta.graphApiVersion, { buttonStyle: config.meta.buttonStyle });
  };
}

function contextFactory(deps: AppDeps) {
  const logger = defaultLogger(deps);
  const clientFor = deps.messengerClientFor ?? defaultClientFor(deps.config);
  const push = deps.pushClient ?? createExpoPushClient();
  return (shop: Shop): ShopContext => {
    const repos = createRepositories(deps.db, shop.id);
    const client = clientFor(shop);
    const notifications = createFacebookNotificationService({ repos, client, logger, now: deps.now });
    const orderPush = createOrderPushService({ repos, push, logger });
    const service = createMessengerService({ repos, client, notifications, orderPush, logger });
    return { shop, repos, notifications, service };
  };
}

/** Commande telle que l'application la reçoit. */
function toRemoteOrder(draft: OrderDraft) {
  return {
    id: draft.id,
    reference: draft.reference,
    customer: { psid: draft.psid, name: draft.customerName },
    mode: draft.mode,
    items: draft.items,
    rawText: draft.rawText,
    needsReview: draft.needsReview,
    receivedAt: draft.createdAt,
    customerStatus: draft.customerStatus,
    delivery: draft.delivery,
  };
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new BadRequestError('Corps JSON attendu.');
  }
}

/** Adresse du client (Cloudflare, proxy ou local) : sert à limiter les essais de code d'appairage. */
function clientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

/** Application HTTP (Node ou Cloudflare Workers). */
export type CarnetApp = Hono<Env>;

/** Tâches périodiques (cron Cloudflare toutes les 30 min, minuteur sur Node) : chaque boutique active. */
export function createScheduledJobs(deps: AppDeps) {
  const logger = defaultLogger(deps);
  const shops = createShopRepository(deps.db, deps.now);
  const contextFor = contextFactory(deps);
  return {
    async run(): Promise<void> {
      const now = deps.now?.() ?? new Date();
      for (const shop of await shops.list()) {
        if (!isShopActive(shop, now)) {
          continue;
        }
        const { repos, notifications } = contextFor(shop);
        try {
          await createCartReminderService({ repos, notifications, logger, now: deps.now }).remindAbandonedCarts();
        } catch (error: unknown) {
          logger.error(`Relance des paniers impossible (${shop.name}) : ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    },
  };
}

/** Message renvoyé à l'application quand l'abonnement de la boutique est fini ou suspendu. */
const SUBSCRIPTION_ENDED = 'Abonnement terminé ou suspendu : contactez le vendeur de l’application pour le renouveler.';

export function buildApp(deps: AppDeps): CarnetApp {
  const { config } = deps;
  const logger = defaultLogger(deps);
  const now = () => deps.now?.() ?? new Date();
  const shops = createShopRepository(deps.db, deps.now);
  const contextFor = contextFactory(deps);
  const facebook =
    deps.facebook !== undefined
      ? deps.facebook
      : config.meta.appId === null
        ? null
        : createFacebookOAuth({ appId: config.meta.appId, appSecret: config.meta.appSecret, graphApiVersion: config.meta.graphApiVersion });
  const pairingFailures = new Map<string, number[]>();
  const app = new Hono<Env>();

  app.onError((error, c) => {
    if (error instanceof BadRequestError) {
      return c.json({ error: error.message }, 400);
    }
    logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return c.json({ error: 'Erreur interne.' }, 500);
  });

  // CORS : uniquement pour les origines déclarées (version web de l'application).
  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    const allowed = origin !== undefined && config.corsOrigins.includes(origin);
    if (c.req.method === 'OPTIONS') {
      const response = c.body(null, 204);
      if (allowed) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Vary', 'Origin');
        response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, ngrok-skip-browser-warning');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      }
      return response;
    }
    await next();
    if (allowed) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Vary', 'Origin');
    }
    return undefined;
  });

  // Pages publiques demandées par Meta (paramètres de l'application et App Review).
  app.get('/privacy', (c) => c.html(privacyPolicyHtml(config.legal)));
  app.get('/data-deletion', (c) => c.html(dataDeletionHtml(config.legal)));

  app.get('/health', (c) =>
    c.json({ ok: true, apiVersion: API_VERSION, messengerLive: config.meta.pageAccessToken !== null || facebook !== null }),
  );

  // --- Webhook Meta ------------------------------------------------------------------------

  /** Vérification de l'URL par Meta lors de l'abonnement au webhook. */
  app.get('/webhooks/messenger', (c) => {
    const token = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge');
    if (
      c.req.query('hub.mode') === 'subscribe' &&
      token !== undefined &&
      sameSecret(token, config.meta.verifyToken) &&
      challenge !== undefined
    ) {
      return c.text(challenge);
    }
    return c.json({ error: 'Vérification refusée.' }, 403);
  });

  /** Boutique de la Page qui reçoit le message (la boutique « default » adopte la première Page inconnue). */
  async function shopForPage(pageId: string): Promise<Shop | null> {
    return (await shops.findByPageId(pageId)) ?? (await shops.claimPageForDefault(pageId));
  }

  /** Réception des messages : signature vérifiée sur le corps brut, réponse 200 immédiate. */
  app.post('/webhooks/messenger', async (c) => {
    const raw = Buffer.from(await c.req.arrayBuffer());
    if (!isValidSignature(raw, c.req.header('x-hub-signature-256'), config.meta.appSecret)) {
      return c.json({ error: 'Signature invalide.' }, 401);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new BadRequestError('JSON invalide.');
    }
    const events = parseWebhookBody(body);
    // Traités un par un, dans l'ordre, après la réponse ; chaque événement va à la boutique de sa Page.
    deps.defer(c, async () => {
      const contexts = new Map<string, ShopContext | null>();
      for (const event of events) {
        if (!contexts.has(event.pageId)) {
          const shop = await shopForPage(event.pageId);
          contexts.set(event.pageId, shop === null || !isShopActive(shop, now()) ? null : contextFor(shop));
        }
        const context = contexts.get(event.pageId) ?? null;
        if (context === null) {
          // Page inconnue ou abonnement fini : le bot se tait.
          logger.info(`Message ignoré : Page ${event.pageId} sans boutique active.`);
          continue;
        }
        await context.service.handleEvent(event satisfies MessengerEvent);
      }
    });
    return c.text('EVENT_RECEIVED');
  });

  // --- Connexion Facebook du vendeur (navigateur ouvert par l'application) -------------------

  /** Adresse de retour de Facebook (même hôte que la requête). */
  const callbackUrl = (c: Context) => `${new URL(c.req.url).origin}/connect/facebook/callback`;

  app.get('/connect/facebook/callback', async (c) => {
    const state = c.req.query('state') ?? '';
    const session = state.length > 0 ? await shops.findOAuth(state) : null;
    if (facebook === null || session === null) {
      return c.html(errorHtml('Lany ny fotoana na tsy mety ny fangatahana. Avereno avy ao amin’ny app.'), 400);
    }
    const code = c.req.query('code');
    if (code === undefined) {
      await shops.endOAuth(state);
      return c.html(errorHtml('Nofoanana ny fidirana Facebook.'));
    }
    const shop = await shops.findById(session.shopId);
    try {
      const userToken = await facebook.exchangeCode(code, callbackUrl(c));
      await shops.setOAuthUserToken(state, userToken);
      return c.html(choosePageHtml(shop?.name ?? '', state, await facebook.listPages(userToken)));
    } catch (error: unknown) {
      logger.error(`Connexion Facebook (${shop?.name ?? session.shopId}) : ${error instanceof Error ? error.message : String(error)}`);
      return c.html(errorHtml(error instanceof FacebookOAuthError ? error.message : 'Nisy olana. Avereno.'), 502);
    }
  });

  /** Page choisie : jeton de Page enregistré, Page abonnée au webhook, retour dans l'application. */
  app.post('/connect/facebook/page', async (c) => {
    const form = await c.req.parseBody();
    const state = typeof form['state'] === 'string' ? form['state'] : '';
    const pageId = typeof form['pageId'] === 'string' ? form['pageId'] : '';
    const session = state.length > 0 ? await shops.findOAuth(state) : null;
    if (facebook === null || session === null || session.userToken === null) {
      return c.html(errorHtml('Lany ny fotoana. Avereno avy ao amin’ny app.'), 400);
    }
    try {
      const page = (await facebook.listPages(session.userToken)).find((candidate) => candidate.id === pageId);
      if (page === undefined) {
        return c.html(errorHtml('Tsy hita io Page io.'), 400);
      }
      await shops.linkPage(session.shopId, page);
      await facebook.subscribePage(page);
      await shops.endOAuth(state);
      logger.info(`Boutique ${session.shopId} reliée à la Page ${page.name}.`);
      return c.html(connectedHtml(page.name));
    } catch (error: unknown) {
      if (error instanceof PageAlreadyLinkedError || error instanceof FacebookOAuthError) {
        return c.html(errorHtml(error.message), 409);
      }
      throw error;
    }
  });

  // --- Administration (vendeur de l'application) ----------------------------------------------

  if (config.adminToken !== null) {
    const adminToken = config.adminToken;
    app.get('/admin', (c) => c.html(ADMIN_HTML));
    app.use('/admin/api/*', async (c, next) => {
      const header = c.req.header('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
      if (!sameSecret(token, adminToken)) {
        return c.json({ error: 'Jeton administrateur incorrect.' }, 401);
      }
      return next();
    });
    const toAdminShop = (shop: Shop, devices = 0) => ({
      id: shop.id,
      name: shop.name,
      activationCode: shop.activationCode,
      pageName: shop.pageName,
      expiresAt: shop.expiresAt,
      suspended: shop.suspendedAt !== null,
      active: isShopActive(shop, now()),
      devices,
    });
    app.get('/admin/api/shops', async (c) =>
      c.json({ shops: (await shops.listWithDevices()).map(({ shop, devices }) => toAdminShop(shop, devices)) }),
    );
    app.post('/admin/api/shops', async (c) => {
      const { name, months } = parseCreateShop(await jsonBody(c));
      return c.json({ shop: toAdminShop(await shops.create(name, months)) }, 201);
    });
    app.post('/admin/api/shops/:id/extend', async (c) => {
      const shop = await shops.extend(c.req.param('id'), parseExtendShop(await jsonBody(c)));
      return shop === null ? c.json({ error: 'Boutique inconnue.' }, 404) : c.json({ shop: toAdminShop(shop) });
    });
    app.post('/admin/api/shops/:id/suspend', async (c) => {
      const shop = await shops.setSuspended(c.req.param('id'), parseSuspendShop(await jsonBody(c)));
      return shop === null ? c.json({ error: 'Boutique inconnue.' }, 404) : c.json({ shop: toAdminShop(shop) });
    });
  }

  // --- API de l'application ------------------------------------------------------------------

  /**
   * Relie un téléphone à une boutique avec son code d'activation (ou l'ancien code d'appairage,
   * pour la boutique « default ») ; renvoie un jeton (montré une seule fois).
   */
  app.post('/v1/devices/pair', async (c) => {
    const ip = clientIp(c);
    const recent = (pairingFailures.get(ip) ?? []).filter((time) => Date.now() - time < PAIRING_WINDOW_MS);
    if (recent.length >= PAIRING_MAX_FAILURES) {
      return c.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429);
    }
    const { pairingCode, deviceName } = parsePairRequest(await jsonBody(c));
    const shop = sameSecret(pairingCode, config.pairingCode)
      ? await shops.findById(DEFAULT_SHOP_ID)
      : await shops.findByActivationCode(pairingCode);
    if (shop === null) {
      pairingFailures.set(ip, [...recent, Date.now()]);
      return c.json({ error: 'Code d’activation incorrect.' }, 403);
    }
    pairingFailures.delete(ip);
    if (!isShopActive(shop, now())) {
      return c.json({ error: SUBSCRIPTION_ENDED }, 402);
    }
    const device = await createRepositories(deps.db, shop.id).devices.create(deviceName);
    return c.json({ deviceId: device.id, token: device.token, apiVersion: API_VERSION, shop: toShopInfo(shop) }, 201);
  });

  /** Boutique vue par l'application (sans jeton de Page). */
  function toShopInfo(shop: Shop) {
    return {
      name: shop.name,
      pageName: shop.pageName,
      pageLinked: shop.pageId !== null,
      expiresAt: shop.expiresAt,
      active: isShopActive(shop, now()),
      facebookLogin: facebook !== null,
    };
  }

  /** Routes protégées par le jeton de l'appareil (en-tête Authorization: Bearer …). */
  app.use('/v1/*', async (c, next) => {
    if (c.req.path === '/v1/devices/pair') {
      return next();
    }
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') === true ? header.slice('Bearer '.length).trim() : '';
    const device = token.length > 0 ? await shops.authenticateDevice(token) : null;
    const shop = device === null ? null : await shops.findById(device.shopId);
    if (device === null || shop === null) {
      return c.json({ error: 'Appareil non autorisé : reliez l’application à nouveau.' }, 401);
    }
    // Abonnement fini : l'application peut encore lire l'état de sa boutique et se déconnecter.
    const alwaysAllowed = c.req.path === '/v1/shop' || c.req.path === '/v1/devices/unpair';
    if (!alwaysAllowed && !isShopActive(shop, now())) {
      return c.json({ error: SUBSCRIPTION_ENDED }, 402);
    }
    c.set('deviceId', device.deviceId);
    c.set('shop', contextFor(shop));
    return next();
  });

  /** Boutique de ce téléphone : nom, Page reliée, fin d'abonnement. */
  app.get('/v1/shop', (c) => c.json(toShopInfo(c.get('shop').shop)));

  /** Adresse de « Se connecter avec Facebook » pour relier (ou changer) la Page de la boutique. */
  app.post('/v1/facebook/connect', async (c) => {
    if (facebook === null) {
      return c.json({ error: 'Connexion Facebook non configurée sur ce serveur (META_APP_ID).' }, 503);
    }
    const state = await shops.startOAuth(c.get('shop').shop.id);
    return c.json({ url: facebook.loginUrl(callbackUrl(c), state) });
  });

  /** L'application envoie son catalogue (noms, prix, quantités disponibles). */
  app.put('/v1/catalog', async (c) => {
    const products = parseCatalog(await jsonBody(c));
    await c.get('shop').repos.catalog.replaceAll(products);
    return c.json({ count: products.length });
  });

  /** Réglages du vendeur utilisés par le bot (frais de livraison dans Antananarivo). */
  app.put('/v1/settings', async (c) => {
    const { deliveryFee } = parseSettings(await jsonBody(c));
    await c.get('shop').repos.settings.setDeliveryFee(deliveryFee);
    return c.json({ deliveryFee });
  });

  /** Commandes Messenger pas encore importées par l'application. */
  app.get('/v1/orders/pending', async (c) =>
    c.json({ orders: (await c.get('shop').repos.drafts.findPending()).map(toRemoteOrder) }),
  );

  /** L'application confirme les commandes enregistrées : elles ne seront plus renvoyées. */
  app.post('/v1/orders/ack', async (c) =>
    c.json({ acknowledged: await c.get('shop').repos.drafts.markDelivered(parseAck(await jsonBody(c))) }),
  );

  /**
   * Prévient le client d'un événement de sa commande : réponse automatique après vérification du stock
   * (CONFIRMED / UNAVAILABLE) ou changement de statut par le vendeur. Renvoie le texte envoyé.
   */
  app.post('/v1/orders/:id/notify', async (c) => {
    const { event, details } = parseNotifyRequest(await jsonBody(c));
    return c.json(await c.get('shop').notifications.notify(c.req.param('id'), event, details));
  });

  /** Message écrit par le vendeur dans l'application, envoyé au client de la commande. */
  app.post('/v1/orders/:id/message', async (c) => {
    const text = parseManualMessage(await jsonBody(c));
    return c.json(await c.get('shop').notifications.sendManual(c.req.param('id'), text));
  });

  /** Historique des réponses envoyées au client pour cette commande, et statut qu'il voit. */
  app.get('/v1/orders/:id/replies', async (c) => {
    const { repos, notifications } = c.get('shop');
    const draft = await repos.drafts.findById(c.req.param('id'));
    if (draft === null) {
      return c.json({ error: 'Commande inconnue.' }, 404);
    }
    const replies = await notifications.history(draft.id);
    return c.json({
      customerStatus: draft.customerStatus,
      replies: replies.map(({ kind, text, status, createdAt }) => ({ kind, text, status, createdAt })),
    });
  });

  /** Enregistre (ou retire avec null) le jeton Expo Push de cet appareil. */
  app.put('/v1/devices/push-token', async (c) => {
    const pushToken = parsePushTokenRequest(await jsonBody(c));
    await c.get('shop').repos.devices.setPushToken(c.get('deviceId'), pushToken);
    return c.json({ ok: true, push: pushToken !== null });
  });

  /** Déconnecte cet appareil (le jeton devient invalide). */
  app.post('/v1/devices/unpair', async (c) => {
    await c.get('shop').repos.devices.revoke(c.get('deviceId'));
    return c.json({ ok: true });
  });

  // --- Outils de développement (désactivés en production) ----------------------------------

  if (config.devTools) {
    /** Réponses envoyées à un client (simulateur), depuis l'identifiant `after`. */
    app.get('/dev/outgoing', async (c) => {
      const repos = createRepositories(deps.db, c.req.query('shop') ?? DEFAULT_SHOP_ID);
      return c.json({
        messages: await repos.outgoing.findRecent(c.req.query('psid') ?? '', Number(c.req.query('after') ?? 0)),
        lastId: await repos.outgoing.lastId(),
      });
    });
  }

  return app;
}
