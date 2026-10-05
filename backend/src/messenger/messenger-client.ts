import type { QuickReply } from '../domain/types.ts';

/** Envoi de messages à un client et lecture de son profil, via l'API Messenger. */
export interface MessengerClient {
  /** true : vrai envoi Meta ; false : simulation (aucun jeton de Page configuré). */
  readonly live: boolean;
  sendText(psid: string, text: string, quickReplies?: readonly QuickReply[]): Promise<void>;
  /** Prénom et nom du client, ou null si le profil n'est pas accessible. */
  getCustomerName(psid: string): Promise<string | null>;
}

export class MessengerApiError extends Error {}

const GRAPH_TIMEOUT_MS = 25_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Client réel : API Graph de Meta (Send API). Le jeton de Page ne quitte jamais le serveur. */
export function createGraphMessengerClient(pageAccessToken: string, graphApiVersion: string): MessengerClient {
  const base = `https://graph.facebook.com/${graphApiVersion}`;

  async function call(path: string, init: RequestInit): Promise<unknown> {
    const separator = path.includes('?') ? '&' : '?';
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(`${base}${path}${separator}access_token=${encodeURIComponent(pageAccessToken)}`, {
        ...init,
        // Meta peut répondre lentement ; Cloudflare autorise 30 s de traitement après la réponse au webhook.
        signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new MessengerApiError(`Meta injoignable après ${Date.now() - startedAt} ms : ${reason}`);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = isRecord(body) && isRecord(body['error']) ? body['error'] : null;
      const message = error !== null && typeof error['message'] === 'string' ? error['message'] : response.statusText;
      throw new MessengerApiError(`Meta ${response.status} : ${message}`);
    }
    return body;
  }

  return {
    live: true,
    async sendText(psid, text, quickReplies) {
      await call('/me/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: psid },
          // Réponse dans la fenêtre de 24 h ouverte par le dernier message du client.
          messaging_type: 'RESPONSE',
          message: {
            text,
            ...(quickReplies === undefined || quickReplies.length === 0
              ? {}
              : {
                  quick_replies: quickReplies.map((reply) => ({
                    content_type: 'text',
                    title: reply.title,
                    payload: reply.payload,
                  })),
                }),
          },
        }),
      });
    },
    async getCustomerName(psid) {
      try {
        const body = await call(`/${encodeURIComponent(psid)}?fields=first_name,last_name`, { method: 'GET' });
        if (!isRecord(body)) {
          return null;
        }
        const name = [body['first_name'], body['last_name']].filter((part) => typeof part === 'string').join(' ');
        return name.length > 0 ? name : null;
      } catch {
        // Profil inaccessible (autorisation non accordée) : la commande reste utilisable sans nom.
        return null;
      }
    },
  };
}

/** Sans jeton de Page : rien n'est envoyé à Meta, les réponses sont seulement journalisées. */
export function createSimulatedMessengerClient(): MessengerClient {
  return {
    live: false,
    async sendText() {
      // Journalisation faite par l'appelant (table outgoing_messages, statut SIMULATED).
    },
    async getCustomerName(psid) {
      return `Client ${psid.slice(-4)}`;
    },
  };
}
