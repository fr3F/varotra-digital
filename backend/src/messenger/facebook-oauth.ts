/**
 * Connexion Facebook du vendeur (OAuth « Facebook Login ») : tout se passe sur le serveur, l'App
 * Secret ne quitte jamais Cloudflare et l'application n'a pas besoin du SDK Facebook.
 */

/** Page administrée par le vendeur, avec son jeton (long, issu d'un jeton utilisateur long). */
export interface FacebookPage {
  readonly id: string;
  readonly name: string;
  readonly accessToken: string;
}

export interface FacebookOAuth {
  /** Adresse de la fenêtre de connexion Facebook. */
  loginUrl(redirectUri: string, state: string): string;
  /** Code renvoyé par Facebook → jeton utilisateur longue durée. */
  exchangeCode(code: string, redirectUri: string): Promise<string>;
  /** Pages que le vendeur administre. */
  listPages(userToken: string): Promise<FacebookPage[]>;
  /** Abonne la Page au webhook de l'application (messages et boutons). */
  subscribePage(page: FacebookPage): Promise<void>;
}

export class FacebookOAuthError extends Error {}

/** Autorisations demandées : lister les Pages, lire et envoyer leurs messages, s'abonner au webhook. */
export const FACEBOOK_SCOPES = ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'] as const;

const TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createFacebookOAuth(options: {
  readonly appId: string;
  readonly appSecret: string;
  readonly graphApiVersion: string;
  readonly fetchImpl?: typeof fetch;
}): FacebookOAuth {
  const fetchImpl = options.fetchImpl ?? fetch;
  const graph = `https://graph.facebook.com/${options.graphApiVersion}`;

  async function call(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new FacebookOAuthError('Facebook injoignable. Réessayez.');
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body)) {
      const error = isRecord(body) && isRecord(body['error']) ? body['error'] : null;
      throw new FacebookOAuthError(typeof error?.['message'] === 'string' ? error['message'] : `Facebook ${response.status}`);
    }
    return body;
  }

  async function accessToken(params: Record<string, string>): Promise<string> {
    const query = new URLSearchParams({ client_id: options.appId, client_secret: options.appSecret, ...params });
    const body = await call(`${graph}/oauth/access_token?${query.toString()}`);
    const token = body['access_token'];
    if (typeof token !== 'string') {
      throw new FacebookOAuthError('Réponse inattendue de Facebook.');
    }
    return token;
  }

  return {
    loginUrl(redirectUri, state) {
      const query = new URLSearchParams({
        client_id: options.appId,
        redirect_uri: redirectUri,
        state,
        response_type: 'code',
        scope: FACEBOOK_SCOPES.join(','),
        // Reposer toutes les questions, dont le choix des Pages : sinon Facebook réutilise en silence
        // les Pages choisies la fois précédente et le vendeur ne peut pas en choisir une autre.
        auth_type: 'reauthorize',
      });
      return `https://www.facebook.com/${options.graphApiVersion}/dialog/oauth?${query.toString()}`;
    },

    async exchangeCode(code, redirectUri) {
      const shortLived = await accessToken({ redirect_uri: redirectUri, code });
      // Jeton long (60 jours) : les jetons de Page qui en dérivent n'expirent pas.
      return accessToken({ grant_type: 'fb_exchange_token', fb_exchange_token: shortLived });
    },

    async listPages(userToken) {
      const query = new URLSearchParams({ fields: 'id,name,access_token', limit: '100', access_token: userToken });
      const body = await call(`${graph}/me/accounts?${query.toString()}`);
      const data = Array.isArray(body['data']) ? body['data'] : [];
      return data.flatMap((page: unknown) =>
        isRecord(page) &&
        typeof page['id'] === 'string' &&
        typeof page['name'] === 'string' &&
        typeof page['access_token'] === 'string'
          ? [{ id: page['id'], name: page['name'], accessToken: page['access_token'] }]
          : [],
      );
    },

    async subscribePage(page) {
      const query = new URLSearchParams({
        subscribed_fields: 'messages,messaging_postbacks',
        access_token: page.accessToken,
      });
      await call(`${graph}/${encodeURIComponent(page.id)}/subscribed_apps?${query.toString()}`, { method: 'POST' });
    },
  };
}
