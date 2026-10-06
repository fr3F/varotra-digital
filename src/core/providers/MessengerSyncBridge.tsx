import { ReactNode, useEffect } from 'react';
import { AppState } from 'react-native';
import { messengerOutboxVersion, messengerStore } from '@/services/messenger/messenger-state';
import { messengerSyncService } from '@/services/messenger/messenger-sync.service';

/**
 * Intervalle de synchronisation tant que l'application est ouverte : une nouvelle commande
 * Messenger apparaît en 15 s au plus. Coût : ~4 requêtes/min par téléphone actif, largement
 * sous le quota gratuit Cloudflare (100 000 requêtes/jour). Les appels ne se chevauchent pas.
 */
const SYNC_INTERVAL_MS = 15_000;

function syncIfConnected(): void {
  if (messengerStore.get().connected) {
    // L'erreur est affichée dans Réglages et notifiée une fois : rien d'autre à faire ici.
    messengerSyncService.sync().catch(() => undefined);
  }
}

/**
 * Synchronise les commandes Messenger : au démarrage, au retour au premier plan, à intervalle
 * régulier, et dès qu'un message au client est en attente. Le backend conserve les commandes
 * tant que l'application ne les a pas récupérées : rien n'est perdu hors ligne.
 */
export function MessengerSyncBridge({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      interval ??= setInterval(syncIfConnected, SYNC_INTERVAL_MS);
    };
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    void messengerSyncService
      .init()
      .then(() => {
        syncIfConnected();
        start();
      })
      .catch((error: unknown) => console.warn('[Carnet] Messenger indisponible', error));

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncIfConnected();
        start();
      } else {
        stop();
      }
    });
    const outbox = messengerOutboxVersion.subscribe(syncIfConnected);

    return () => {
      stop();
      appState.remove();
      outbox();
    };
  }, []);

  return <>{children}</>;
}
