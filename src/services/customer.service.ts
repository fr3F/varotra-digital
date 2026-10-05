import { ValidationError } from '@/core/errors/app-error';
import { createEntityStore, loadInto } from '@/core/state/entity-state';
import { clientRepository } from '@/database/repositories/client.repository';
import { customerHistoryRepository } from '@/database/repositories/customer-history.repository';
import { orderRepository } from '@/database/repositories/order.repository';
import { Client, ClientInput, ClientSummary, CustomerProfile, CustomerStats, EntityId, PurchaseHistoryEntry } from '@/models';
import { isSamePhone } from '@/utils/phone.utils';

/** Carnet client réactif : chaque client avec ses chiffres clés. */
export const customerStore = createEntityStore<ClientSummary>();

function computeStats(history: readonly PurchaseHistoryEntry[]): CustomerStats {
  const orders = history.filter((entry) => entry.kind === 'ORDER');
  const purchases = history.filter((entry) => entry.kind === 'SALE' || entry.status === 'DELIVERED');
  const totalSpent = purchases.reduce((total, entry) => total + entry.amount, 0);
  return {
    orderCount: orders.length,
    openOrderCount: orders.filter(
      (entry) => entry.status === 'NEW' || entry.status === 'PREPARING' || entry.status === 'CONFIRMED',
    ).length,
    purchaseCount: purchases.length,
    totalSpent,
    averageBasket: purchases.length === 0 ? 0 : Math.round(totalSpent / purchases.length),
    // L'historique est trié du plus récent au plus ancien.
    lastPurchaseAt: purchases[0]?.occurredAt ?? null,
  };
}

/** Refuse un numéro déjà attribué à un autre client actif. */
async function assertPhoneAvailable(phone: string | null, excludedId: EntityId | null): Promise<void> {
  if (phone === null) {
    return;
  }
  const clients = await clientRepository.findAll();
  const duplicate = clients.find(
    (client) => client.id !== excludedId && client.phone !== null && isSamePhone(client.phone, phone),
  );
  if (duplicate !== undefined) {
    throw new ValidationError(`Ce numéro est déjà enregistré pour « ${duplicate.name} ».`);
  }
}

/** Gestion du carnet client et de l'historique d'achat. */
export const customerService = {
  load(): Promise<void> {
    return loadInto(customerStore, () => customerHistoryRepository.findSummaries());
  },

  getById(id: EntityId): Promise<Client> {
    return clientRepository.getById(id);
  },

  /** Fiche complète : coordonnées, statistiques, historique et produits préférés. */
  async getProfile(id: EntityId): Promise<CustomerProfile> {
    const [client, history, topProducts] = await Promise.all([
      clientRepository.getById(id),
      customerHistoryRepository.findHistory(id),
      customerHistoryRepository.findTopProducts(id),
    ]);
    return { client, stats: computeStats(history), history, topProducts };
  },

  async create(input: ClientInput): Promise<Client> {
    await assertPhoneAvailable(input.phone, null);
    const client = await clientRepository.create(input);
    await customerService.load();
    return client;
  },

  async update(id: EntityId, input: ClientInput): Promise<Client> {
    await assertPhoneAvailable(input.phone, id);
    const client = await clientRepository.update(id, input);
    await customerService.load();
    return client;
  },

  /**
   * Suppression logique : l'historique (commandes, ventes) reste rattaché au client.
   * Refusée tant qu'une commande est en cours.
   */
  async remove(id: EntityId): Promise<void> {
    const client = await clientRepository.getById(id);
    const openOrders = await orderRepository.countOpenByClient(id);
    if (openOrders > 0) {
      throw new ValidationError(
        `« ${client.name} » a ${openOrders} commande(s) en cours : livrez-les ou annulez-les avant de le supprimer.`,
      );
    }
    await clientRepository.softDelete(id);
    await customerService.load();
  },
};
