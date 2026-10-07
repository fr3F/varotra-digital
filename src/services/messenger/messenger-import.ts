import { database } from '@/database/database';
import { clientRepository } from '@/database/repositories/client.repository';
import { productRepository } from '@/database/repositories/product.repository';
import { Client, Order, OrderLineDraft, RemoteOrder } from '@/models';
import { orderService } from '../order.service';
import { stockService } from '../stock.service';
import { facebookReplyService } from './facebook-reply.service';
import { messengerStore } from './messenger-state';

const MODE_LABELS: Readonly<Record<RemoteOrder['mode'], string>> = {
  GUIDED: 'commande guidée (boutons)',
  TEXT: 'message libre reconnu automatiquement',
  RAW: 'message transmis tel quel : à compléter',
};

/**
 * Réponse automatique après vérification du stock :
 * - tout est disponible → commande validée (stock réservé) et « Votre commande est confirmée. » ;
 * - stock insuffisant → « Produit indisponible actuellement. » avec le détail ; la commande reste
 *   « Nouvelle » pour le vendeur (réassort, proposition d'un autre produit…).
 */
async function autoReply(order: Order, lines: readonly OrderLineDraft[]): Promise<void> {
  if (order.stockCheck === 'OK') {
    try {
      await orderService.changeStatus(order.id, 'CONFIRMED', 'Validée automatiquement : stock disponible.', {
        automaticReply: true,
      });
      return;
    } catch {
      // Stock pris entre l'import et la validation : on répond « indisponible » ci-dessous.
    }
  }
  const unavailable = await stockService.findShortages(lines);
  await facebookReplyService.queue(order, 'UNAVAILABLE', { automatic: true, unavailable });
}

/** Retrouve (ou crée, ou restaure) le client à partir de son identifiant Messenger. */
async function resolveClient(remote: RemoteOrder): Promise<Client> {
  const existing = await clientRepository.findByMessengerId(remote.customer.psid);
  if (existing !== null) {
    return existing.deleted ? clientRepository.restore(existing.client.id) : existing.client;
  }
  return clientRepository.create({
    name: remote.customer.name ?? 'Client Messenger',
    phone: null,
    address: null,
    notes: 'Client créé automatiquement depuis Messenger.',
    messengerId: remote.customer.psid,
  });
}

/** Commande locale issue de cette commande Messenger (identifiant serveur), ou null si pas encore importée. */
export async function findImportedOrderId(remoteId: string): Promise<string | null> {
  const row = await database.selectOne(`SELECT id FROM orders WHERE source = 'MESSENGER' AND external_ref = ?`, [
    remoteId,
  ]);
  const id = row?.['id'];
  return typeof id === 'string' ? id : null;
}

/**
 * Importe une commande Messenger dans l'application : client, lignes (produits encore existants),
 * vérification automatique du stock. Idempotent : une commande déjà importée est ignorée.
 * Renvoie true si la commande vient d'être créée, false si elle était déjà présente.
 */
export async function importRemoteOrder(remote: RemoteOrder): Promise<boolean> {
  const alreadyImported = await database.selectOne(
    `SELECT id FROM orders WHERE source = 'MESSENGER' AND external_ref = ?`,
    [remote.id],
  );
  if (alreadyImported !== null) {
    return false;
  }

  const { order, lines, unclear } = await database.transaction(async () => {
    const client = await resolveClient(remote);
    const lines: OrderLineDraft[] = [];
    const missing: string[] = [];
    for (const item of remote.items) {
      const product = await productRepository.findById(item.productId);
      if (product === null) {
        missing.push(`${item.quantity} × ${item.productName}`);
      } else {
        lines.push({ productId: product.id, quantity: item.quantity, unitPrice: item.unitPrice });
      }
    }
    const notes = [
      `Messenger ${remote.reference} — ${MODE_LABELS[remote.mode]}.`,
      missing.length > 0 ? `Produits introuvables dans le catalogue : ${missing.join(', ')}.` : null,
    ]
      .filter((part): part is string => part !== null)
      .join('\n');

    // Message incompris ou produit inconnu : le vendeur décide, pas de réponse automatique.
    const isUnclear = remote.mode === 'RAW' || missing.length > 0 || lines.length === 0;
    const created = await orderService.create(
      { clientId: client.id, notes, lines },
      {
        externalRef: remote.id,
        customerMessage: remote.rawText,
        needsReview: remote.needsReview || isUnclear,
        orderedAt: remote.receivedAt,
      },
    );
    return { order: created, lines, unclear: isUnclear };
  });

  if (messengerStore.get().autoReply && !unclear) {
    await autoReply(order, lines);
  }
  return true;
}
