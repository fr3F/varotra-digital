/**
 * Serveur Node (développement local, simulateur, auto-hébergement).
 * En production sur Cloudflare, le point d'entrée est src/worker.ts.
 */
import { serve } from '@hono/node-server';
import { buildApp, createScheduledJobs } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';
import { openNodeDatabase } from './db/node-sqlite.ts';
import { createTaskQueue } from './messenger/messenger-service.ts';

function main(): void {
  const config = loadConfig();
  const db = openNodeDatabase(config.databasePath);
  const queue = createTaskQueue();
  const log = (level: string) => (message: string) => console.log(`[${new Date().toISOString()}] ${level} ${message}`);

  const deps = {
    config,
    db,
    defer: (_c: unknown, task: () => Promise<void>) => queue.push(task),
    logger: { info: log('INFO'), error: log('ERREUR') },
  };
  const app = buildApp(deps);
  // Même fréquence que le cron Cloudflare : relance des paniers abandonnés.
  const jobs = createScheduledJobs(deps);
  const timer = setInterval(() => queue.push(() => jobs.run()), 30 * 60 * 1000);

  const live = config.meta.pageAccessToken !== null || config.meta.appId !== null;
  if (!live) {
    console.warn('Ni META_PAGE_ACCESS_TOKEN ni META_APP_ID : mode simulation, aucune réponse n’est envoyée à Meta.');
  }
  if (config.devTools) {
    console.warn('DEV_TOOLS=true : routes /dev actives. À désactiver en production.');
  }

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    const url = `http://localhost:${info.port}`;
    // Le serveur tourne tant que la fenêtre reste ouverte : il n'y a pas de « fin » à attendre.
    console.log(`
============================================================
 ✅ Serveur LOCAL démarré : ${url}  (${live ? 'Messenger réel' : 'simulation'})
    Il tourne tant que cette fenêtre reste ouverte : c'est normal.
    Arrêter : Ctrl + C

 Ce serveur sert aux essais sur ce PC.
 Pour mettre en ligne le vrai serveur (Cloudflare) : npm run deploy
============================================================`);
  });

  const shutdown = (): void => {
    clearInterval(timer);
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
