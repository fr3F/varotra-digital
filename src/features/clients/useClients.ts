import { useEffect, useMemo } from 'react';
import { useStore } from '@/core/state/store';
import { ClientSummary } from '@/models';
import { customerService, customerStore } from '@/services/customer.service';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}

/** Recherche par nom, adresse (sans accents) ou téléphone (espaces et tirets ignorés). */
function matches({ client }: ClientSummary, query: string, digits: string): boolean {
  if (normalize(client.name).includes(query)) {
    return true;
  }
  if (client.address !== null && normalize(client.address).includes(query)) {
    return true;
  }
  return digits.length >= 2 && client.phone !== null && client.phone.replace(/\D/g, '').includes(digits);
}

/** Carnet client réactif, filtré par la recherche. */
export function useClients(search = '') {
  const state = useStore(customerStore);

  useEffect(() => {
    if (state.status === 'idle') {
      void customerService.load();
    }
  }, [state.status]);

  const summaries = useMemo(() => {
    const query = normalize(search);
    if (query.length === 0) {
      return state.items;
    }
    const digits = search.replace(/\D/g, '');
    return state.items.filter((summary) => matches(summary, query, digits));
  }, [state.items, search]);

  const clients = useMemo(() => summaries.map((summary) => summary.client), [summaries]);

  return {
    summaries,
    clients,
    totalCount: state.items.length,
    loading: state.status === 'idle' || state.status === 'loading',
    error: state.error,
    reload: customerService.load,
  };
}
