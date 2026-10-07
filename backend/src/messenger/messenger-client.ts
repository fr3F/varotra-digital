import type { ButtonStyle } from '../config.ts';
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

/** Limites Meta du modèle « bouton » : 3 boutons, 640 caractères de texte. */
const TEMPLATE_MAX_BUTTONS = 3;
const TEMPLATE_MAX_TEXT = 640;
/** Texte des bulles qui portent seulement des boutons (suite du modèle, ou réponses rapides de `text_first`). */
const MORE_BUTTONS_TEXT = '👇';

/** Corps `message` d'un envoi à l'API Send. */
export type OutgoingMessage = Readonly<Record<string, unknown>>;

/**
 * Message(s) à envoyer pour un texte et ses boutons.
 * - `text_first` : le texte seul (lisible sur Facebook Lite, choix numérotés dedans), puis une bulle
 *   « 👇 » qui porte les réponses rapides pour Messenger ;
 * - `quick_replies` : un seul message, boutons au-dessus du clavier (pas sur Facebook Lite) ;
 * - `template` : boutons dans la bulle (modèle « bouton », visibles sur Facebook Lite), par groupes
 *   de 3 ; un texte trop long part d'abord seul. Un appui renvoie un postback avec la même charge.
 */
export function buildMessages(text: string, quickReplies: readonly QuickReply[] | undefined, style: ButtonStyle): OutgoingMessage[] {
  const replies = quickReplies ?? [];
  if (replies.length === 0) {
    return [{ text }];
  }
  const quickReplyButtons = replies.map((reply) => ({ content_type: 'text', title: reply.title, payload: reply.payload }));
  if (style === 'text_first') {
    return [{ text }, { text: MORE_BUTTONS_TEXT, quick_replies: quickReplyButtons }];
  }
  if (style === 'quick_replies') {
    return [{ text, quick_replies: quickReplyButtons }];
  }
  const groups: QuickReply[][] = [];
  for (let index = 0; index < replies.length; index += TEMPLATE_MAX_BUTTONS) {
    groups.push(replies.slice(index, index + TEMPLATE_MAX_BUTTONS));
  }
  const fitsInTemplate = text.length <= TEMPLATE_MAX_TEXT;
  const template = (bubbleText: string, buttons: readonly QuickReply[]): OutgoingMessage => ({
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text: bubbleText,
        buttons: buttons.map((button) => ({ type: 'postback', title: button.title, payload: button.payload })),
      },
    },
  });
  return [
    ...(fitsInTemplate ? [] : [{ text }]),
    ...groups.map((buttons, index) => template(index === 0 && fitsInTemplate ? text : MORE_BUTTONS_TEXT, buttons)),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Client réel : API Graph de Meta (Send API). Le jeton de Page ne quitte jamais le serveur. */
export function createGraphMessengerClient(
  pageAccessToken: string,
  graphApiVersion: string,
  options: { readonly buttonStyle?: ButtonStyle; readonly fetchImpl?: typeof fetch } = {},
): MessengerClient {
  const buttonStyle = options.buttonStyle ?? 'text_first';
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = `https://graph.facebook.com/${graphApiVersion}`;

  async function call(path: string, init: RequestInit): Promise<unknown> {
    const separator = path.includes('?') ? '&' : '?';
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}${separator}access_token=${encodeURIComponent(pageAccessToken)}`, {
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
      // Plusieurs bulles possibles (boutons par groupes de 3) : envoyées dans l'ordre.
      for (const message of buildMessages(text, quickReplies, buttonStyle)) {
        await call('/me/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: psid },
            // Réponse dans la fenêtre de 24 h ouverte par le dernier message du client.
            messaging_type: 'RESPONSE',
            message,
          }),
        });
      }
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
