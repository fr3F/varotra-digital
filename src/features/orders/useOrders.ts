import { useEffect, useMemo } from 'react';
import { useStore } from '@/core/state/store';
import { OrderStatus } from '@/models';
import { orderService, orderStore } from '@/services/order.service';

export interface OrderFilters {
  /** Recherche sur la référence et le nom du client. */
  readonly search: string;
  /** null = tous les statuts. */
  readonly status: OrderStatus | null;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function useOrders({ search, status }: OrderFilters) {
  const state = useStore(orderStore);

  useEffect(() => {
    if (state.status === 'idle') {
      void orderService.load();
    }
  }, [state.status]);

  const orders = useMemo(() => {
    const query = normalize(search);
    return state.items.filter(
      ({ order, clientName }) =>
        (status === null || order.status === status) &&
        (query.length === 0 ||
          normalize(order.reference).includes(query) ||
          (clientName !== null && normalize(clientName).includes(query))),
    );
  }, [state.items, search, status]);

  const countsByStatus = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    state.items.forEach(({ order }) => counts.set(order.status, (counts.get(order.status) ?? 0) + 1));
    return counts;
  }, [state.items]);

  return {
    orders,
    countsByStatus,
    totalCount: state.items.length,
    loading: state.status === 'idle' || state.status === 'loading',
    error: state.error,
    reload: orderService.load,
  };
}
