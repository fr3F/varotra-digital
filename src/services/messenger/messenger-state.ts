import { createStore } from '@/core/state/store';
import { MessengerState } from '@/models';

/** État réactif de la liaison Messenger (affiché dans Réglages, lu par les services). */
export const messengerStore = createStore<MessengerState>({
  connected: false,
  backendUrl: null,
  deviceName: null,
  lastSyncAt: null,
  lastError: null,
  syncing: false,
  syncCount: 0,
  autoReply: true,
  notifyCustomer: true,
  pushActive: false,
});

/**
 * Incrémenté quand un message au client est mis en file d'attente : le pont de synchronisation
 * s'y abonne pour l'envoyer aussitôt (sans que OrderService dépende du service de synchro).
 */
export const messengerOutboxVersion = createStore(0);
