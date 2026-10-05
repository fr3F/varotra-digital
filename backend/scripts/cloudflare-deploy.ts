/**
 * Déploiement Cloudflare (Workers + D1) en une commande :
 *   npx wrangler login            (une seule fois)
 *   npm run cloudflare:deploy
 *
 * 1. crée la base D1 « carnet-backend » si besoin et l'inscrit dans wrangler.jsonc ;
 * 2. applique les migrations (migrations/*.sql) ;
 * 3. déploie le Worker ;
 * 4. envoie les secrets (générés au premier lancement, conservés dans .cloudflare-secrets.json) ;
 * 5. affiche l'adresse du serveur, le code d'appairage et les valeurs à saisir chez Meta.
 *
 * Pour ajouter les valeurs Meta : les écrire dans .cloudflare-secrets.json puis relancer la commande.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const WRANGLER_CONFIG = join(ROOT, 'wrangler.jsonc');
const SECRETS_FILE = join(ROOT, '.cloudflare-secrets.json');
const DATABASE_NAME = 'carnet-backend';

const SECRET_KEYS = ['META_APP_SECRET', 'META_VERIFY_TOKEN', 'APP_PAIRING_CODE', 'META_PAGE_ACCESS_TOKEN'] as const;
type Secrets = Record<(typeof SECRET_KEYS)[number], string>;

function step(message: string): void {
  console.log(`\n\x1b[1;36m==> ${message}\x1b[0m`);
}

/** Lance wrangler et renvoie sa sortie (affichée en même temps). */
function wrangler(args: readonly string[], options: { quiet?: boolean } = {}): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    // Arguments internes (jamais saisis par l'utilisateur), mis entre guillemets pour les chemins.
    const command = ['npx', 'wrangler', ...args.map((arg) => (/s/.test(arg) ? `"${arg}"` : arg))].join(' ');
    const child = spawn(command, { cwd: ROOT, shell: true, env: { ...process.env, CI: 'true' } });
    let output = '';
    const collect = (chunk: Buffer, stream: NodeJS.WriteStream) => {
      output += chunk.toString();
      if (options.quiet !== true) {
        stream.write(chunk);
      }
    };
    child.stdout.on('data', (chunk: Buffer) => collect(chunk, process.stdout));
    child.stderr.on('data', (chunk: Buffer) => collect(chunk, process.stderr));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function fail(message: string): never {
  console.error(`\n\x1b[1;31m✖ ${message}\x1b[0m`);
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function findDatabaseId(): Promise<string | null> {
  const { code, output } = await wrangler(['d1', 'list', '--json'], { quiet: true });
  if (code !== 0) {
    fail(`Impossible de lister les bases D1.\n${output}`);
  }
  const json = output.slice(output.indexOf('['));
  const list: unknown = JSON.parse(json);
  if (!Array.isArray(list)) {
    return null;
  }
  const match = list.find((entry: unknown) => isRecord(entry) && entry['name'] === DATABASE_NAME);
  return isRecord(match) && typeof match['uuid'] === 'string' ? match['uuid'] : null;
}

function loadSecrets(): Secrets {
  const stored: Partial<Secrets> = existsSync(SECRETS_FILE) ? (JSON.parse(readFileSync(SECRETS_FILE, 'utf8')) as Partial<Secrets>) : {};
  const secrets: Secrets = {
    META_APP_SECRET: stored.META_APP_SECRET ?? `a-remplacer-${randomBytes(6).toString('hex')}`,
    META_VERIFY_TOKEN: stored.META_VERIFY_TOKEN ?? randomBytes(24).toString('hex'),
    APP_PAIRING_CODE: stored.APP_PAIRING_CODE ?? randomBytes(5).toString('hex').toUpperCase(),
    META_PAGE_ACCESS_TOKEN: stored.META_PAGE_ACCESS_TOKEN ?? '',
  };
  writeFileSync(SECRETS_FILE, `${JSON.stringify(secrets, null, 2)}\n`);
  return secrets;
}

async function main(): Promise<void> {
  step('Compte Cloudflare');
  const whoami = await wrangler(['whoami'], { quiet: true });
  if (whoami.code !== 0 || /not authenticated|You are not logged in/i.test(whoami.output)) {
    fail('Connectez-vous d’abord : npx wrangler login');
  }
  console.log('Connecté.');

  step(`Base de données D1 « ${DATABASE_NAME} »`);
  let databaseId = await findDatabaseId();
  if (databaseId === null) {
    const created = await wrangler(['d1', 'create', DATABASE_NAME]);
    if (created.code !== 0) {
      fail('Création de la base D1 impossible.');
    }
    databaseId = await findDatabaseId();
  }
  if (databaseId === null) {
    fail('Base D1 introuvable après création.');
  }
  const config = readFileSync(WRANGLER_CONFIG, 'utf8');
  writeFileSync(WRANGLER_CONFIG, config.replace(/"database_id":\s*"[^"]*"/, `"database_id": "${databaseId}"`));
  console.log(`Base : ${databaseId}`);

  step('Migrations');
  if ((await wrangler(['d1', 'migrations', 'apply', DATABASE_NAME, '--remote'])).code !== 0) {
    fail('Migrations impossibles.');
  }

  step('Déploiement du Worker');
  const deployed = await wrangler(['deploy']);
  if (deployed.code !== 0) {
    fail(
      'Déploiement impossible. Si Cloudflare demande un sous-domaine workers.dev : ouvrez une fois ' +
        '« Workers & Pages » dans le tableau de bord Cloudflare, puis relancez la commande.',
    );
  }
  const url = /https:\/\/[a-z0-9.-]+\.workers\.dev/i.exec(deployed.output)?.[0] ?? null;

  step('Secrets');
  const secrets = loadSecrets();
  const bulkFile = join(ROOT, '.cloudflare-secrets.upload.json');
  // Les secrets vides ne sont pas envoyés (ex. jeton de Page pas encore disponible).
  const toUpload = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value.length > 0));
  writeFileSync(bulkFile, JSON.stringify(toUpload));
  const bulk = await wrangler(['secret', 'bulk', bulkFile]);
  rmSync(bulkFile, { force: true });
  if (bulk.code !== 0) {
    fail('Envoi des secrets impossible.');
  }

  const base = url ?? 'https://carnet-digital-backend.<votre-sous-domaine>.workers.dev';
  const metaReady = !secrets.META_APP_SECRET.startsWith('a-remplacer-') && secrets.META_PAGE_ACCESS_TOKEN.length > 0;
  console.log(`
================================================================================
 Backend déployé sur Cloudflare.
 Adresse du serveur (application)  : ${base}
 Code d'appairage (application)    : ${secrets.APP_PAIRING_CODE}
 URL du webhook (Meta)             : ${base}/webhooks/messenger
 Jeton de vérification (Meta)      : ${secrets.META_VERIFY_TOKEN}
 Confidentialité (Meta)            : ${base}/privacy
 Suppression des données (Meta)    : ${base}/data-deletion
 Messenger                         : ${metaReady ? 'clés Meta envoyées' : 'clés Meta manquantes'}
${
  metaReady
    ? ''
    : `
 Étape suivante : copiez l'App Secret et le Page Access Token de Meta dans
   ${SECRETS_FILE}
 puis relancez : npm run cloudflare:deploy
`
}================================================================================`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
