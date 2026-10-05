import { Client, ClientInput } from '@/models';
import { parseOptionalPhone } from '@/utils/phone.utils';
import { optionalText, requireText } from '@/utils/validation.utils';

export type ClientFormValues = {
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly notes: string;
};

export const EMPTY_CLIENT_FORM: ClientFormValues = { name: '', phone: '', address: '', notes: '' };

export function clientToFormValues(client: Client): ClientFormValues {
  return {
    name: client.name,
    phone: client.phone ?? '',
    address: client.address ?? '',
    notes: client.notes ?? '',
  };
}

/** `messengerId` n'est pas saisi : il est conservé tel quel (alimenté par la future synchro). */
export function parseClientForm(values: ClientFormValues, existing: Client | null): ClientInput {
  return {
    name: requireText(values.name, 'Nom'),
    phone: parseOptionalPhone(values.phone),
    address: optionalText(values.address),
    notes: optionalText(values.notes),
    messengerId: existing?.messengerId ?? null,
  };
}
