/** Configuration lue depuis les variables d'environnement (fichier .env en local). */
export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly databasePath: string;
  readonly meta: {
    /** Secret de l'application Meta : sert à vérifier la signature de chaque webhook. */
    readonly appSecret: string;
    /** Jeton choisi par vous, saisi aussi dans le tableau de bord Meta (vérification du webhook). */
    readonly verifyToken: string;
    /**
     * Identifiant de l'application Meta : active « Se connecter avec Facebook » (une Page par boutique).
     * Absent : seules les boutiques déjà reliées fonctionnent.
     */
    readonly appId: string | null;
    /** Jeton de la Page de la boutique « default » (ancienne configuration à une seule Page). */
    readonly pageAccessToken: string | null;
    readonly graphApiVersion: string;
    /**
     * Forme des boutons du bot : `template` (boutons dans la bulle, visibles aussi sur Facebook Lite)
     * ou `quick_replies` (réponses rapides au-dessus du clavier, absentes de Facebook Lite).
     */
    readonly buttonStyle: ButtonStyle;
  };
  /** Ancien code d'appairage : relie un téléphone à la boutique « default ». */
  readonly pairingCode: string;
  /** Jeton de l'administrateur (page /admin : boutiques, codes d'activation, abonnements). Absent : /admin désactivé. */
  readonly adminToken: string | null;
  /** Origines autorisées à appeler l'API depuis un navigateur (version web de l'app). */
  readonly corsOrigins: readonly string[];
  /** Nom et contact affichés sur les pages /privacy et /data-deletion (exigées par Meta). */
  readonly legal: { readonly businessName: string; readonly contactEmail: string | null };
  /**
   * Adresse de la dernière APK (lien EAS) : /apk y redirige, pour donner aux vendeurs un lien qui
   * ne change pas d'une version à l'autre. Absente : /apk indique que l'application n'est pas disponible.
   */
  readonly apkUrl: string | null;
  /** Active les routes /dev (lecture des réponses envoyées, utile au simulateur). Jamais en production. */
  readonly devTools: boolean;
}

export type ButtonStyle = 'text_first' | 'template' | 'quick_replies';
const BUTTON_STYLES: readonly ButtonStyle[] = ['text_first', 'template', 'quick_replies'];

export class ConfigError extends Error {}

function required(env: NodeJS.ProcessEnv, name: string, minLength = 1): string {
  const value = env[name]?.trim();
  if (value === undefined || value.length < minLength) {
    throw new ConfigError(
      minLength > 1
        ? `Variable ${name} manquante ou trop courte (${minLength} caractères minimum).`
        : `Variable ${name} manquante.`,
    );
  }
  return value;
}

function optional(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value.length === 0 ? null : value;
}

/**
 * Emplacement de la base SQLite : DATABASE_PATH, sinon le volume Railway s'il est attaché
 * (données conservées entre deux déploiements), sinon un dossier local.
 */
function databasePath(env: NodeJS.ProcessEnv): string {
  const explicit = optional(env, 'DATABASE_PATH');
  if (explicit !== null) {
    return explicit;
  }
  const volume = optional(env, 'RAILWAY_VOLUME_MOUNT_PATH');
  return volume === null ? 'data/carnet-backend.db' : `${volume.replace(/\/+$/, '')}/carnet-backend.db`;
}

function apkUrl(env: NodeJS.ProcessEnv): string | null {
  const value = optional(env, 'APK_URL');
  if (value !== null && !/^https:\/\/\S+$/.test(value)) {
    throw new ConfigError('Variable APK_URL : adresse https:// attendue.');
  }
  return value;
}

function adminToken(env: NodeJS.ProcessEnv): string | null {
  const value = optional(env, 'ADMIN_TOKEN');
  if (value !== null && value.length < 16) {
    throw new ConfigError('Variable ADMIN_TOKEN trop courte (16 caractères minimum).');
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env['PORT'] ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new ConfigError('PORT invalide.');
  }
  return {
    port,
    host: optional(env, 'HOST') ?? '0.0.0.0',
    databasePath: databasePath(env),
    meta: {
      appSecret: required(env, 'META_APP_SECRET', 8),
      verifyToken: required(env, 'META_VERIFY_TOKEN', 8),
      appId: optional(env, 'META_APP_ID'),
      pageAccessToken: optional(env, 'META_PAGE_ACCESS_TOKEN'),
      graphApiVersion: optional(env, 'META_GRAPH_API_VERSION') ?? 'v25.0',
      buttonStyle: BUTTON_STYLES.find((style) => style === optional(env, 'META_BUTTON_STYLE')) ?? 'text_first',
    },
    pairingCode: required(env, 'APP_PAIRING_CODE', 8),
    adminToken: adminToken(env),
    corsOrigins: (optional(env, 'CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    legal: {
      businessName: optional(env, 'BUSINESS_NAME') ?? 'Carnet Digital',
      contactEmail: optional(env, 'CONTACT_EMAIL'),
    },
    apkUrl: apkUrl(env),
    devTools: env['DEV_TOOLS'] === 'true',
  };
}
