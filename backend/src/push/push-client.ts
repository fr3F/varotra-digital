/** Envoi de notifications push au téléphone du vendeur via le service Expo Push (gratuit, sans clé). */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TIMEOUT_MS = 10_000;

export interface PushMessage {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
  /** Canal Android créé par l'application (un par type de notification). */
  readonly channelId: string;
}

/** Résultat par message, dans l'ordre d'envoi. `unregistered` : jeton à oublier (application désinstallée…). */
export type PushResult = 'ok' | 'unregistered' | 'error';

export interface PushClient {
  send(messages: readonly PushMessage[]): Promise<PushResult[]>;
}

export class PushError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Jeton tel que fourni par `getExpoPushTokenAsync` : ExponentPushToken[…] (ou ExpoPushToken[…]). */
export function isExpoPushToken(value: string): boolean {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$/.test(value);
}

function toResult(ticket: unknown): PushResult {
  if (!isRecord(ticket)) {
    return 'error';
  }
  if (ticket['status'] === 'ok') {
    return 'ok';
  }
  const details = ticket['details'];
  return isRecord(details) && details['error'] === 'DeviceNotRegistered' ? 'unregistered' : 'error';
}

export function createExpoPushClient(fetchImpl: typeof fetch = fetch): PushClient {
  return {
    async send(messages) {
      if (messages.length === 0) {
        return [];
      }
      let response: Response;
      try {
        response = await fetchImpl(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify(messages.map((message) => ({ ...message, priority: 'high', sound: 'default' }))),
          signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
        });
      } catch (error: unknown) {
        throw new PushError(`Expo Push injoignable : ${error instanceof Error ? error.message : String(error)}`);
      }
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || !Array.isArray(body['data'])) {
        throw new PushError(`Expo Push ${response.status} : réponse inattendue.`);
      }
      const tickets = body['data'];
      return messages.map((_, index) => toResult(tickets[index]));
    },
  };
}
