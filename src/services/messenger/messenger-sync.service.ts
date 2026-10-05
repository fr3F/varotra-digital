import { toErrorMessage, ValidationError } from '@/core/errors/app-error';
import { messengerReplyRepository } from '@/database/repositories/messenger-reply.repository';
import { productRepository } from '@/database/repositories/product.repository';
import { settingsRepository } from '@/database/repositories/settings.repository';
import { availableQuantity, MessengerState, SyncReport } from '@/models';
import { nowIso } from '@/utils/date.utils';
import { customerService } from '../customer.service';
import { notificationService } from '../notifications/notification.service';
import { orderService } from '../order.service';
import { productService } from '../product.service';
import { MessengerApiError, messengerApi, normalizeBackendUrl } from './messenger-api';
import { importRemoteOrder } from './messenger-import';
import { messengerStore } from './messenger-state';
import { secureToken } from './secure-token';

const PREFIX = 'messenger.';
const KEYS = {
  backendUrl: `${PREFIX}backendUrl`,
  deviceName: `${PREFIX}deviceName`,
  lastSyncAt: `${PREFIX}lastSyncAt`,
  autoReply: `${PREFIX}autoReply`,
  notifyCustomer: `${PREFIX}notifyCustomer`,
} as const;

let running: Promise<SyncReport> | null = null;
/** Une seule notification d'erreur par série d'échecs (pas une par tentative). */
let errorNotified = false;

function update(patch: Partial<MessengerState>): void {
  messengerStore.set((state) => ({ ...state, ...patch }));
}

async function connection(): Promise<{ baseUrl: string; token: string } | null> {
  const { backendUrl } = messengerStore.get();
  const token = await secureToken.get();
  return backendUrl === null || token === null ? null : { baseUrl: backendUrl, token };
}

/** Catalogue envoyé au backend : il sert à lire les messages et à proposer les produits disponibles. */
async function buildCatalog() {
  const products = await productRepository.findAll();
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    unitPrice: product.unitPrice,
    available: availableQuantity(product),
  }));
}

/** Envoie les réponses Facebook en attente ; un échec réseau est retenté au cycle suivant. */
async function flushReplies(baseUrl: string, token: string): Promise<number> {
  let sent = 0;
  for (const entry of await messengerReplyRepository.findPending()) {
    try {
      const { result, text } = await messengerApi.notifyCustomer(
        baseUrl,
        token,
        entry.externalRef,
        entry.kind,
        entry.unavailable,
      );
      await messengerReplyRepository.markProcessed(entry.id, result, text);
      sent += result === 'DELIVERED' ? 1 : 0;
    } catch (error: unknown) {
      if (error instanceof MessengerApiError && error.status === null) {
        throw error; // hors ligne : inutile d'essayer les suivants
      }
      await messengerReplyRepository.markAttemptFailed(entry.id);
    }
  }
  return sent;
}

async function runSync(): Promise<SyncReport> {
  const target = await connection();
  if (target === null) {
    return { imported: 0, customerUpdatesSent: 0 };
  }
  update({ syncing: true });
  try {
    await messengerApi.pushCatalog(target.baseUrl, target.token, await buildCatalog());

    const remoteOrders = await messengerApi.pendingOrders(target.baseUrl, target.token);
    const stored: string[] = [];
    let imported = 0;
    for (const remote of remoteOrders) {
      // Une commande qui échoue à l'import n'est pas acquittée : elle sera retentée.
      try {
        imported += (await importRemoteOrder(remote)) ? 1 : 0;
        stored.push(remote.id);
      } catch (error: unknown) {
        console.warn(`[Carnet] Import Messenger ${remote.reference} impossible`, error);
      }
    }
    // Accusé de réception uniquement pour ce qui est enregistré localement.
    await messengerApi.acknowledge(target.baseUrl, target.token, stored);

    const customerUpdatesSent = await flushReplies(target.baseUrl, target.token);

    const lastSyncAt = nowIso();
    await settingsRepository.set(KEYS.lastSyncAt, lastSyncAt);
    messengerStore.set((state) => ({ ...state, lastSyncAt, lastError: null, syncing: false, syncCount: state.syncCount + 1 }));
    errorNotified = false;
    if (imported > 0) {
      // De nouveaux clients ont pu être créés à partir de Messenger.
      await Promise.all([orderService.load(), productService.load(), customerService.load()]);
    }
    return { imported, customerUpdatesSent };
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    update({ lastError: message, syncing: false });
    if (!errorNotified) {
      errorNotified = true;
      notificationService.notifySyncError(message);
    }
    if (error instanceof MessengerApiError && error.status === 401) {
      // Appareil révoqué côté serveur : il faut le relier à nouveau.
      await secureToken.clear();
      update({ connected: false });
    }
    throw error;
  }
}

/** Liaison avec le backend Messenger et synchronisation des commandes. */
export const messengerSyncService = {
  /** Charge l'état enregistré (adresse, réglages, dernière synchro). À appeler au démarrage. */
  async init(): Promise<void> {
    const stored = await settingsRepository.getAll(PREFIX);
    const token = await secureToken.get();
    const backendUrl = stored.get(KEYS.backendUrl) ?? null;
    update({
      connected: backendUrl !== null && backendUrl.length > 0 && token !== null,
      backendUrl: backendUrl === null || backendUrl.length === 0 ? null : backendUrl,
      deviceName: stored.get(KEYS.deviceName) ?? null,
      lastSyncAt: stored.get(KEYS.lastSyncAt) ?? null,
      // Activée par défaut : stock disponible → confirmée, sinon « Produit indisponible actuellement. ».
      autoReply: stored.get(KEYS.autoReply) !== '0',
      notifyCustomer: stored.get(KEYS.notifyCustomer) !== '0',
    });
  },

  /** Relie ce téléphone au backend avec le code d'appairage défini sur le serveur. */
  async connect(url: string, pairingCode: string, deviceName: string): Promise<SyncReport> {
    if (pairingCode.trim().length === 0) {
      throw new ValidationError('Saisissez le code d’appairage du serveur.');
    }
    const baseUrl = normalizeBackendUrl(url);
    const name = deviceName.trim().length > 0 ? deviceName.trim() : 'Téléphone';
    const token = await messengerApi.pair(baseUrl, pairingCode.trim(), name);
    await secureToken.set(token);
    await settingsRepository.set(KEYS.backendUrl, baseUrl);
    await settingsRepository.set(KEYS.deviceName, name);
    update({ connected: true, backendUrl: baseUrl, deviceName: name, lastError: null });
    return messengerSyncService.sync();
  },

  async disconnect(): Promise<void> {
    const target = await connection();
    if (target !== null) {
      await messengerApi.unpair(target.baseUrl, target.token).catch(() => undefined);
    }
    await secureToken.clear();
    await settingsRepository.set(KEYS.backendUrl, '');
    update({ connected: false, backendUrl: null, lastError: null });
  },

  async setAutoReply(enabled: boolean): Promise<void> {
    await settingsRepository.set(KEYS.autoReply, enabled ? '1' : '0');
    update({ autoReply: enabled });
  },

  async setNotifyCustomer(enabled: boolean): Promise<void> {
    await settingsRepository.set(KEYS.notifyCustomer, enabled ? '1' : '0');
    update({ notifyCustomer: enabled });
  },

  /** Lance une synchronisation (une seule à la fois ; un appel pendant la synchro attend la même). */
  sync(): Promise<SyncReport> {
    if (running === null) {
      running = runSync().finally(() => {
        running = null;
      });
    }
    return running;
  },

};
