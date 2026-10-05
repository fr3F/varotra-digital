/**
 * Serveur Node (développement local, simulateur, auto-hébergement).
 * En production sur Cloudflare, le point d'entrée est src/worker.ts.
 */
import { serve } from '@hono/node-server';
import { buildApp } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';
import { openNodeDatabase } from './db/node-sqlite.ts';
import { createRepositories } from './db/repositories.ts';
import { createGraphMessengerClient, createSimulatedMessengerClient } from './messenger/messenger-client.ts';
import { createTaskQueue } from './messenger/messenger-service.ts';

function main(): void {
  const config = loadConfig();
  const db = openNodeDatabase(config.databasePath);
  const messengerClient =
    config.meta.pageAccessToken === null
      ? createSimulatedMessengerClient()
      : createGraphMessengerClient(config.meta.pageAccessToken, config.meta.graphApiVersion);
  const queue = createTaskQueue();
  const log = (level: string) => (message: string) => console.log(`[${new Date().toISOString()}] ${level} ${message}`);

  const app = buildApp({
    config,
    repos: createRepositories(db),
    messengerClient,
    defer: (_c, task) => queue.push(task),
    logger: { info: log('INFO'), error: log('ERREUR') },
  });

  if (!messengerClient.live) {
    console.warn('META_PAGE_ACCESS_TOKEN absent : mode simulation, aucune réponse n’est envoyée à Meta.');
  }
  if (config.devTools) {
    console.warn('DEV_TOOLS=true : routes /dev actives. À désactiver en production.');
  }

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    console.log(`Serveur à l’écoute sur http://${config.host}:${info.port}`);
  });

  const shutdown = (): void => {
    server.close(() => {
      void queue.idle().then(() => {
        db.close();
        process.exit(0);
      });
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof ConfigError ? `Configuration : ${error.message}` : error);
  process.exit(1);
}
