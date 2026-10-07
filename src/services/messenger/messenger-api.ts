import { AppError } from '@/core/errors/app-error';
import {
  CustomerReplyKind,
  CustomerReplyResult,
  RemoteDelivery,
  RemoteOrder,
  RemoteOrderItem,
  ShopInfo,
  UnavailableItem,
} from '@/models';

/** Erreur réseau ou serveur lors d'un échange avec le backend Messenger. */
export class MessengerApiError extends AppError {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super('NETWORK', message);
    this.name = 'MessengerApiError';
  }
}

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly unitPrice: number;
  readonly available: number;
  /** Argument de vente montré au client par le bot. */
  readonly description: string | null;
}

const TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseItem(value: unknown): RemoteOrderItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const productId = str(value['productId']);
  const productName = str(value['productName']);
  const quantity = num(value['quantity']);
  const unitPrice = num(value['unitPrice']);
  return productId === null || productName === null || quantity === null || unitPrice === null
    ? null
    : { productId, productName, quantity, unitPrice };
}

/** Valide une commande reçue du backend ; null si elle est mal formée (ignorée, jamais importée à moitié). */
export function parseRemoteOrder(value: unknown): RemoteOrder | null {
  if (!isRecord(value) || !isRecord(value['customer']) || !Array.isArray(value['items'])) {
    return null;
  }
  const id = str(value['id']);
  const reference = str(value['reference']);
  const psid = str(value['customer']['psid']);
  const receivedAt = str(value['receivedAt']);
  const mode = value['mode'];
  const items = value['items'].map(parseItem);
  if (
    id === null ||
    reference === null ||
    psid === null ||
    receivedAt === null ||
    (mode !== 'GUIDED' && mode !== 'TEXT' && mode !== 'RAW') ||
    items.some((item) => item === null)
  ) {
    return null;
  }
  return {
    id,
    reference,
    customer: { psid, name: str(value['customer']['name']) },
    mode,
    items: items.filter((item): item is RemoteOrderItem => item !== null),
    rawText: str(value['rawText']),
    needsReview: value['needsReview'] === true,
    receivedAt,
    delivery: parseDelivery(value['delivery']),
  };
}

/** Coordonnées de livraison ; null si absentes ou mal formées (la commande reste importable). */
function parseDelivery(value: unknown): RemoteDelivery | null {
  if (!isRecord(value)) {
    return null;
  }
  const phone = str(value['phone']);
  const address = str(value['address']);
  const zone = value['zone'];
  if (phone === null || address === null || (zone !== 'TANA' && zone !== 'OTHER')) {
    return null;
  }
  return { phone, address, zone, fee: num(value['fee']) };
}

/** Boutique renvoyée par GET /v1/shop ; null si la réponse est mal formée. */
export function parseShopInfo(value: unknown): ShopInfo | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = str(value['name']);
  const expiresAt = str(value['expiresAt']);
  if (name === null || expiresAt === null) {
    return null;
  }
  return {
    name,
    pageName: str(value['pageName']),
    pageLinked: value['pageLinked'] === true,
    expiresAt,
    active: value['active'] === true,
    facebookLogin: value['facebookLogin'] === true,
  };
}

/** Résultat d'un envoi au client renvoyé par le serveur (notification ou message du vendeur). */
function toReplyResult(body: unknown): { result: CustomerReplyResult; text: string | null } {
  const text = isRecord(body) ? str(body['text']) : null;
  if (isRecord(body) && body['delivered'] === true) {
    return { result: 'DELIVERED', text };
  }
  const reason = isRecord(body) ? body['reason'] : null;
  return { result: reason === 'OUTSIDE_WINDOW' || reason === 'UNKNOWN_ORDER' ? reason : 'SEND_FAILED', text };
}

/** Normalise l'adresse saisie (sans « / » final). */
export function normalizeBackendUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) {
    throw new MessengerApiError('Adresse du serveur invalide (ex. https://mon-serveur.com).', null);
  }
  return trimmed;
}

async function request(baseUrl: string, path: string, init: RequestInit & { token?: string }): Promise<unknown> {
  // ngrok-skip-browser-warning : évite la page d'avertissement de ngrok (tests avec un tunnel, version web).
  const headers: Record<string, string> = { Accept: 'application/json', 'ngrok-skip-browser-warning': '1' };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (init.token !== undefined) {
    headers['Authorization'] = `Bearer ${init.token}`;
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new MessengerApiError('Serveur Messenger injoignable : vérifiez la connexion Internet et l’adresse.', null);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(body) ? str(body['error']) : null;
    throw new MessengerApiError(message ?? `Erreur du serveur Messenger (${response.status}).`, response.status);
  }
  return body;
}

/** Appels au backend Messenger. L'application ne parle jamais directement à Facebook. */
export const messengerApi = {
  async pair(baseUrl: string, pairingCode: string, deviceName: string): Promise<string> {
    const body = await request(baseUrl, '/v1/devices/pair', {
      method: 'POST',
      body: JSON.stringify({ pairingCode, deviceName }),
    });
    const token = isRecord(body) ? str(body['token']) : null;
    if (token === null) {
      throw new MessengerApiError('Réponse inattendue du serveur lors de l’appairage.', null);
    }
    return token;
  },

  async unpair(baseUrl: string, token: string): Promise<void> {
    await request(baseUrl, '/v1/devices/unpair', { method: 'POST', body: '{}', token });
  },

  /** Jeton Expo Push du téléphone (null : plus de notification push). */
  async setPushToken(baseUrl: string, token: string, pushToken: string | null): Promise<void> {
    await request(baseUrl, '/v1/devices/push-token', { method: 'PUT', body: JSON.stringify({ pushToken }), token });
  },

  /** Boutique de ce téléphone : Page reliée, fin d'abonnement. */
  async shop(baseUrl: string, token: string): Promise<ShopInfo> {
    const shop = parseShopInfo(await request(baseUrl, '/v1/shop', { method: 'GET', token }));
    if (shop === null) {
      throw new MessengerApiError('Réponse inattendue du serveur (boutique).', null);
    }
    return shop;
  },

  /**
   * Adresse de « Se connecter avec Facebook » (fenêtre ouverte dans le navigateur). returnUrl : adresse
   * qui rouvre l'application à la fin (carnetdigital://… dans l'APK, exp://… dans Expo Go).
   */
  async facebookConnectUrl(baseUrl: string, token: string, returnUrl: string): Promise<string> {
    const body = await request(baseUrl, '/v1/facebook/connect', {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
      token,
    });
    const url = isRecord(body) ? str(body['url']) : null;
    if (url === null) {
      throw new MessengerApiError('Réponse inattendue du serveur (connexion Facebook).', null);
    }
    return url;
  },

  /** Frais de livraison dans Antananarivo annoncés par le bot. */
  async setDeliveryFee(baseUrl: string, token: string, deliveryFee: number): Promise<void> {
    await request(baseUrl, '/v1/settings', { method: 'PUT', body: JSON.stringify({ deliveryFee }), token });
  },

  async pushCatalog(baseUrl: string, token: string, products: readonly CatalogEntry[]): Promise<void> {
    await request(baseUrl, '/v1/catalog', { method: 'PUT', body: JSON.stringify({ products }), token });
  },

  async pendingOrders(baseUrl: string, token: string): Promise<RemoteOrder[]> {
    const body = await request(baseUrl, '/v1/orders/pending', { method: 'GET', token });
    const orders = isRecord(body) && Array.isArray(body['orders']) ? body['orders'] : [];
    return orders.map(parseRemoteOrder).filter((order): order is RemoteOrder => order !== null);
  },

  async acknowledge(baseUrl: string, token: string, ids: readonly string[]): Promise<void> {
    if (ids.length > 0) {
      await request(baseUrl, '/v1/orders/ack', { method: 'POST', body: JSON.stringify({ ids }), token });
    }
  },

  /** Demande au backend de prévenir le client ; renvoie le résultat et le texte envoyé. */
  /** Message écrit par le vendeur, envoyé tel quel au client de la commande. */
  async sendMessage(
    baseUrl: string,
    token: string,
    remoteId: string,
    text: string,
  ): Promise<{ result: CustomerReplyResult; text: string | null }> {
    const body = await request(baseUrl, `/v1/orders/${encodeURIComponent(remoteId)}/message`, {
      method: 'POST',
      body: JSON.stringify({ text }),
      token,
    });
    return toReplyResult(body);
  },

  /** Frais de livraison convenus : le serveur les enregistre et les annonce au client (sa langue). */
  async sendDeliveryFee(
    baseUrl: string,
    token: string,
    remoteId: string,
    deliveryFee: number,
  ): Promise<{ result: CustomerReplyResult; text: string | null }> {
    const body = await request(baseUrl, `/v1/orders/${encodeURIComponent(remoteId)}/delivery-fee`, {
      method: 'POST',
      body: JSON.stringify({ deliveryFee }),
      token,
    });
    return toReplyResult(body);
  },

  async notifyCustomer(
    baseUrl: string,
    token: string,
    remoteId: string,
    kind: CustomerReplyKind,
    unavailable: readonly UnavailableItem[],
  ): Promise<{ result: CustomerReplyResult; text: string | null }> {
    const body = await request(baseUrl, `/v1/orders/${encodeURIComponent(remoteId)}/notify`, {
      method: 'POST',
      body: JSON.stringify(unavailable.length > 0 ? { event: kind, unavailable } : { event: kind }),
      token,
    });
    return toReplyResult(body);
  },
};
