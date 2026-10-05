import { EntityId, PaymentMethod, SaleDraft } from '@/models';
import { parseProductLines, ProductLineFormValue } from '@/shared/forms/product-lines-form';
import { optionalText } from '@/utils/validation.utils';

export interface SaleFormState {
  readonly clientId: EntityId | null;
  readonly paymentMethod: PaymentMethod;
  readonly notes: string;
  readonly lines: readonly ProductLineFormValue[];
}

export const EMPTY_SALE_FORM: SaleFormState = { clientId: null, paymentMethod: 'CASH', notes: '', lines: [] };

export function parseSaleForm(state: SaleFormState, nameOf: (productId: EntityId) => string): SaleDraft {
  return {
    clientId: state.clientId,
    paymentMethod: state.paymentMethod,
    notes: optionalText(state.notes),
    lines: parseProductLines(state.lines, nameOf),
  };
}
