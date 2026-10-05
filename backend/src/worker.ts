/**
 * Point d'entrée Cloudflare Workers (production gratuite) : base D1, secrets Wrangler,
 * traitement des messages Meta après la réponse via `waitUntil`.
 */
import type { ExecutionContext } from 'hono';
import { buildApp, type CarnetApp } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';
import { type D1DatabaseLike, d1Database } from './db/d1.ts';
import { createRepositories } from './db/repositories.ts';
import { createGraphMessengerClient, createSimulatedMessengerClient } from './messenger/messenger-client.ts';

interface WorkerEnv {
  readonly DB: D1DatabaseLike;
  readonly [name: string]: unknown;
}

/** Variables texte (vars et secrets) sous la forme attendue par loadConfig. */
function stringVars(env: WorkerEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(env).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : [])),
  );
}

// L'application est construite une fois par instance du Worker (la limitation des essais
// d'appairage est donc conservée entre les requêtes servies par cette instance).
let cached: { app: CarnetApp; key: WorkerEnv } | null = null;

function appFor(env: WorkerEnv): CarnetApp {
  if (cached !== null && cached.key === env) {
    return cached.app;
  }
  const config = loadConfig(stringVars(env));
  const messengerClient =
    config.meta.pageAccessToken === null
      ? createSimulatedMessengerClient()
      : createGraphMessengerClient(config.meta.pageAccessToken, config.meta.graphApiVersion);
  const app = buildApp({
    config,
    repos: createRepositories(d1Database(env.DB)),
    messengerClient,
    defer: (c, task) => c.executionCtx.waitUntil(task()),
    logger: { info: (message) => console.log(message), error: (message) => console.error(message) },
  });
  cached = { app, key: env };
  return app;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    try {
      return await appFor(env).fetch(request, env, ctx);
    } catch (error: unknown) {
      const message = error instanceof ConfigError ? `Configuration : ${error.message}` : 'Erreur interne.';
      console.error(error);
      return Response.json({ error: message }, { status: 500 });
    }
  },
};
