import type { Repositories } from '../db/repositories.ts';
import type { OrderDraft } from '../domain/types.ts';
import { formatMoney } from '../shared/format.ts';
import type { PushClient } from './push-client.ts';

interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/** Canal Android « Nouvelles commandes » créé par l'application. */
const NEW_ORDER_CHANNEL = 'orders-new';

function summary(draft: OrderDraft): string {
  if (draft.items.length === 0) {
    return draft.rawText === null ? 'Commande à vérifier' : `« ${draft.rawText.slice(0, 80)} »`;
  }
  const lines = draft.items.map((item) => `${item.quantity} × ${item.productName}`).join(', ');
  const total = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return `${lines} · ${formatMoney(total)}`;
}

/** Prévient chaque téléphone relié (jeton push enregistré) qu'une commande Messenger vient d'arriver. */
export function createOrderPushService(deps: { readonly repos: Repositories; readonly push: PushClient; readonly logger: Logger }) {
  const { repos, push, logger } = deps;
  return {
    /** N'échoue jamais : la commande reste disponible à la prochaine synchronisation de l'application. */
    async notifyNewOrder(draft: OrderDraft): Promise<void> {
      try {
        const devices = await repos.devices.findPushTargets();
        if (devices.length === 0) {
          return;
        }
        const title = `Nouvelle commande ${draft.reference}${draft.customerName === null ? '' : ` · ${draft.customerName}`}`;
        const body = `${summary(draft)}${draft.needsReview ? ' · à vérifier' : ''}`;
        const results = await push.send(
          devices.map((device) => ({
            to: device.pushToken,
            title,
            body,
            data: { screen: 'messenger-order', id: draft.id },
            channelId: NEW_ORDER_CHANNEL,
          })),
        );
        for (const [index, result] of results.entries()) {
          const device = devices[index];
          if (result === 'unregistered' && device !== undefined) {
            await repos.devices.setPushToken(device.id, null);
          }
        }
        logger.info(`Push « ${draft.reference} » : ${results.filter((result) => result === 'ok').length}/${results.length} envoyé(s).`);
      } catch (error: unknown) {
        logger.error(`Push « ${draft.reference} » impossible : ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

export type OrderPushService = ReturnType<typeof createOrderPushService>;
