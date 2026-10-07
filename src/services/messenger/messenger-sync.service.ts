import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { DEFAULT_DELIVERY_FEE } from '@/core/constants/app.constants';
import { toErrorMessage, ValidationError } from '@/core/errors/app-error';
import { messengerReplyRepository } from '@/database/repositories/messenger-reply.repository';
import { productRepository } from '@/database/repositories/product.repository';
import { settingsRepository } from '@/database/repositories/settings.repository';
import { availableQuantity, MessengerState, SyncReport } from '@/models';
import { nowIso } from '@/utils/date.utils';
import { customerService } from '../customer.service';
import { notificationCenter } from '../notifications/notification-center';
import { notificationPreferencesStore, notificationService } from '../notifications/notification.service';
import { orderService } from '../order.service';
import { productService } from '../product.service';
import { parseDeliveryFee } from '@/utils/money.utils';
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
  /** Dernier jeton push transmis au serveur ('' : aucun). */
  pushToken: `${PREFIX}pushToken`,
  deliveryFee: `${PREFIX}deliveryFee`,
  /** Derniers frais de livraison transmis au serveur ('' : jamais). */
  deliveryFeeSent: `${PREFIX}deliveryFeeSent`,
} as const;



let running: Promise<SyncReport> | null = null;
/** Jeton Expo Push de ce téléphone, obtenu une fois par lancement (undefined : pas encore demandé). */
let devicePushToken: string | null | undefined;
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
    description: product.description,
  }));
}

/** Identifiant du projet EAS (présent après `eas init`) : nécessaire pour obtenir un jeton push. */
function easProjectId(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  const eas: unknown = typeof extra === 'object' && extra !== null && 'eas' in extra ? extra.eas : null;
  const fromExtra: unknown = typeof eas === 'object' && eas !== null && 'projectId' in eas ? eas.projectId : null;
  const projectId = typeof fromExtra === 'string' ? fromExtra : Constants.easConfig?.projectId;
  return typeof projectId === 'string' && projectId.length > 0 ? projectId : null;
}

/**
 * Transmet au serveur le jeton push voulu (null si les notifications « Nouvelle commande » sont
 * désactivées ou indisponibles), seulement quand il change. Un échec ne bloque pas la synchro.
 */
async function syncPushToken(baseUrl: string, token: string): Promise<void> {
  if (devicePushToken === undefined) {
    const projectId = easProjectId();
    devicePushToken = projectId === null ? null : await notificationCenter.getPushToken(projectId).catch(() => null);
  }
  const wanted = notificationPreferencesStore.get().NEW_ORDER ? devicePushToken : null;
  const stored = await settingsRepository.getAll(PREFIX);
  if ((wanted ?? '') !== (stored.get(KEYS.pushToken) ?? '')) {
    await messengerApi.setPushToken(baseUrl, token, wanted);
    await settingsRepository.set(KEYS.pushToken, wanted ?? '');
  }
  notificationService.setRemotePushActive(wanted !== null);
  update({ pushActive: wanted !== null });
}

/** Transmet au serveur les frais de livraison annoncés par le bot, seulement quand ils changent. */
async function syncDeliveryFee(baseUrl: string, token: string): Promise<void> {
  const { deliveryFee } = messengerStore.get();
  const stored = await settingsRepository.getAll(PREFIX);
  if (stored.get(KEYS.deliveryFeeSent) !== String(deliveryFee)) {
    await messengerApi.setDeliveryFee(baseUrl, token, deliveryFee);
    await settingsRepository.set(KEYS.deliveryFeeSent, String(deliveryFee));
  }
}

/** Envoie les réponses Facebook en attente ; un échec réseau est retenté au cycle suivant. */
async function flushReplies(baseUrl: string, token: string): Promise<number> {
  let sent = 0;
  for (const entry of await messengerReplyRepository.findPending()) {
    try {
      const { result, text } =
        entry.kind === 'MANUAL'
          ? await messengerApi.sendMessage(baseUrl, token, entry.externalRef, entry.messageText ?? '')
          : entry.kind === 'DELIVERY_FEE'
            ? await messengerApi.sendDeliveryFee(baseUrl, token, entry.externalRef, entry.deliveryFee ?? 0)
            : await messengerApi.notifyCustomer(baseUrl, token, entry.externalRef, entry.kind, entry.unavailable);
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
    const shop = await messengerApi.shop(target.baseUrl, target.token);
    update({ shop });
    if (!shop.active) {
      throw new ValidationError('Abonnement terminé ou suspendu : contactez le vendeur de l’application pour le renouveler.');
    }
    await messengerApi.pushCatalog(target.baseUrl, target.token, await buildCatalog());
    await syncDeliveryFee(target.baseUrl, target.token);
    await syncPushToken(target.baseUrl, target.token).catch((error: unknown) =>
      console.warn('[Carnet] Jeton push non transmis', error),
    );

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
    const deliveryFee = Number(stored.get(KEYS.deliveryFee) ?? DEFAULT_DELIVERY_FEE);
    update({
      connected: backendUrl !== null && backendUrl.length > 0 && token !== null,
      backendUrl: backendUrl === null || backendUrl.length === 0 ? null : backendUrl,
      deviceName: stored.get(KEYS.deviceName) ?? null,
      lastSyncAt: stored.get(KEYS.lastSyncAt) ?? null,
      // Activée par défaut : stock disponible → confirmée, sinon « Produit indisponible actuellement. ».
      autoReply: stored.get(KEYS.autoReply) !== '0',
      notifyCustomer: stored.get(KEYS.notifyCustomer) !== '0',
      deliveryFee: Number.isSafeInteger(deliveryFee) && deliveryFee >= 0 ? deliveryFee : DEFAULT_DELIVERY_FEE,
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
    // Nouvel appareil côté serveur : le jeton push et les frais doivent lui être transmis à nouveau.
    await settingsRepository.set(KEYS.pushToken, '');
    await settingsRepository.set(KEYS.deliveryFeeSent, '');
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
    await settingsRepository.set(KEYS.pushToken, '');
    notificationService.setRemotePushActive(false);
    update({ connected: false, backendUrl: null, lastError: null, pushActive: false, shop: null });
  },

  async setAutoReply(enabled: boolean): Promise<void> {
    await settingsRepository.set(KEYS.autoReply, enabled ? '1' : '0');
    update({ autoReply: enabled });
  },

  /** Frais de livraison dans Antananarivo (Ariary) : enregistrés puis transmis au serveur. */
  async setDeliveryFee(value: string): Promise<void> {
    const fee = parseDeliveryFee(value);
    if (fee === null) {
      throw new ValidationError('Frais de livraison : montant entre 0 et 1 000 000 Ar.');
    }
    await settingsRepository.set(KEYS.deliveryFee, String(fee));
    update({ deliveryFee: fee });
    if (messengerStore.get().connected) {
      await messengerSyncService.sync();
    }
  },

  /**
   * « Se connecter avec Facebook » : le vendeur se connecte et choisit sa Page dans le navigateur,
   * puis revient dans l'application. Renvoie true si une Page est reliée ensuite.
   */
  async connectFacebook(): Promise<boolean> {
    const target = await connection();
    if (target === null) {
      throw new ValidationError('Saisissez d’abord votre code d’activation.');
    }
    // Adresse de retour (route /messenger) : carnetdigital://messenger dans l'APK, exp://…/--/messenger
    // dans Expo Go, qui ne connaît pas le schéma de app.json.
    const returnUrl = Linking.createURL('messenger');
    const url = await messengerApi.facebookConnectUrl(target.baseUrl, target.token, returnUrl);
    await WebBrowser.openAuthSessionAsync(url, returnUrl);
    const shop = await messengerApi.shop(target.baseUrl, target.token);
    update({ shop });
    if (shop.pageLinked) {
      await messengerSyncService.sync();
    }
    return shop.pageLinked;
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
