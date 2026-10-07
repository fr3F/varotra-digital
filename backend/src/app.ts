import { timingSafeEqual } from 'node:crypto';
import { type Context, Hono } from 'hono';
import { dataDeletionHtml, privacyPolicyHtml } from './api/legal-pages.ts';
import {
  BadRequestError,
  parseAck,
  parseCatalog,
  parseManualMessage,
  parseNotifyRequest,
  parsePairRequest,
  parseSettings,
  parsePushTokenRequest,
} from './api/validation.ts';
import type { AppConfig } from './config.ts';
import type { Repositories } from './db/repositories.ts';
import type { OrderDraft } from './domain/types.ts';
import { createCartReminderService } from './messenger/cart-reminder.service.ts';
import { createFacebookNotificationService } from './messenger/facebook-notification.service.ts';
import type { MessengerClient } from './messenger/messenger-client.ts';
import { createMessengerService } from './messenger/messenger-service.ts';
import { isValidSignature } from './messenger/signature.ts';
import { parseWebhookBody } from './messenger/webhook-events.ts';
import { createOrderPushService } from './push/order-push.service.ts';
import { createExpoPushClient, type PushClient } from './push/push-client.ts';

const API_VERSION = '1';
const PAIRING_MAX_FAILURES = 5;
const PAIRING_WINDOW_MS = 10 * 60 * 1000;

type Env = { Variables: { deviceId: string } };

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export interface AppDeps {
  readonly config: AppConfig;
  readonly repos: Repositories;
  readonly messengerClient: MessengerClient;
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

/** Tâches périodiques (cron Cloudflare toutes les 30 min, minuteur sur Node). */
export function createScheduledJobs(deps: AppDeps) {
  const logger: Logger = deps.logger ?? { info: () => undefined, error: (message) => console.error(message) };
  const notifications = createFacebookNotificationService({ repos: deps.repos, client: deps.messengerClient, logger, now: deps.now });
  const reminders = createCartReminderService({ repos: deps.repos, notifications, logger, now: deps.now });
  return {
    async run(): Promise<void> {
      try {
        await reminders.remindAbandonedCarts();
      } catch (error: unknown) {
        logger.error(`Relance des paniers impossible : ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

export function buildApp(deps: AppDeps): CarnetApp {
  const { config, repos } = deps;
  const logger: Logger = deps.logger ?? { info: () => undefined, error: (message) => console.error(message) };
  const notifications = createFacebookNotificationService({ repos, client: deps.messengerClient, logger, now: deps.now });
  const orderPush = createOrderPushService({ repos, push: deps.pushClient ?? createExpoPushClient(), logger });
  const service = createMessengerService({ repos, client: deps.messengerClient, notifications, orderPush, logger });
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

  app.get('/health', (c) => c.json({ ok: true, apiVersion: API_VERSION, messengerLive: deps.messengerClient.live }));

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
    // Traités un par un, dans l'ordre, après la réponse.
    deps.defer(c, async () => {
      for (const event of events) {
        await service.handleEvent(event);
      }
    });
    return c.text('EVENT_RECEIVED');
  });

  // --- API de l'application ------------------------------------------------------------------

  /** Relie un téléphone au backend avec le code d'appairage ; renvoie un jeton (montré une seule fois). */
  app.post('/v1/devices/pair', async (c) => {
    const ip = clientIp(c);
    const recent = (pairingFailures.get(ip) ?? []).filter((time) => Date.now() - time < PAIRING_WINDOW_MS);
    if (recent.length >= PAIRING_MAX_FAILURES) {
      return c.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429);
    }
    const { pairingCode, deviceName } = parsePairRequest(await jsonBody(c));
    if (!sameSecret(pairingCode, config.pairingCode)) {
      pairingFailures.set(ip, [...recent, Date.now()]);
      return c.json({ error: 'Code d’appairage incorrect.' }, 403);
    }
    pairingFailures.delete(ip);
    const device = await repos.devices.create(deviceName);
    return c.json({ deviceId: device.id, token: device.token, apiVersion: API_VERSION }, 201);
  });

  /** Routes protégées par le jeton de l'appareil (en-tête Authorization: Bearer …). */
  app.use('/v1/*', async (c, next) => {
    if (c.req.path === '/v1/devices/pair') {
      return next();
    }
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') === true ? header.slice('Bearer '.length).trim() : '';
    const deviceId = token.length > 0 ? await repos.devices.authenticate(token) : null;
    if (deviceId === null) {
      return c.json({ error: 'Appareil non autorisé : reliez l’application à nouveau.' }, 401);
    }
    c.set('deviceId', deviceId);
    return next();
  });

  /** L'application envoie son catalogue (noms, prix, quantités disponibles). */
  app.put('/v1/catalog', async (c) => {
    const products = parseCatalog(await jsonBody(c));
    await repos.catalog.replaceAll(products);
    return c.json({ count: products.length });
  });

  /** Réglages du vendeur utilisés par le bot (frais de livraison dans Antananarivo). */
  app.put('/v1/settings', async (c) => {
    const { deliveryFee } = parseSettings(await jsonBody(c));
    await repos.settings.setDeliveryFee(deliveryFee);
    return c.json({ deliveryFee });
  });

  /** Commandes Messenger pas encore importées par l'application. */
  app.get('/v1/orders/pending', async (c) => c.json({ orders: (await repos.drafts.findPending()).map(toRemoteOrder) }));

  /** L'application confirme les commandes enregistrées : elles ne seront plus renvoyées. */
  app.post('/v1/orders/ack', async (c) =>
    c.json({ acknowledged: await repos.drafts.markDelivered(parseAck(await jsonBody(c))) }),
  );

  /**
   * Prévient le client d'un événement de sa commande : réponse automatique après vérification du stock
   * (CONFIRMED / UNAVAILABLE) ou changement de statut par le vendeur. Renvoie le texte envoyé.
   */
  app.post('/v1/orders/:id/notify', async (c) => {
    const { event, details } = parseNotifyRequest(await jsonBody(c));
    return c.json(await notifications.notify(c.req.param('id'), event, details));
  });

  /** Message écrit par le vendeur dans l'application, envoyé au client de la commande. */
  app.post('/v1/orders/:id/message', async (c) => {
    const text = parseManualMessage(await jsonBody(c));
    return c.json(await notifications.sendManual(c.req.param('id'), text));
  });

  /** Historique des réponses envoyées au client pour cette commande, et statut qu'il voit. */
  app.get('/v1/orders/:id/replies', async (c) => {
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
    await repos.devices.setPushToken(c.get('deviceId'), pushToken);
    return c.json({ ok: true, push: pushToken !== null });
  });

  /** Déconnecte cet appareil (le jeton devient invalide). */
  app.post('/v1/devices/unpair', async (c) => {
    await repos.devices.revoke(c.get('deviceId'));
    return c.json({ ok: true });
  });

  // --- Outils de développement (désactivés en production) ----------------------------------

  if (config.devTools) {
    /** Réponses envoyées à un client (simulateur), depuis l'identifiant `after`. */
    app.get('/dev/outgoing', async (c) =>
      c.json({
        messages: await repos.outgoing.findRecent(c.req.query('psid') ?? '', Number(c.req.query('after') ?? 0)),
        lastId: await repos.outgoing.lastId(),
      }),
    );
  }

  return app;
}
