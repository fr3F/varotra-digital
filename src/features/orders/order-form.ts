import { EntityId, OrderDetail, OrderDraft } from '@/models';
import { parseProductLines, ProductLineFormValue } from '@/shared/forms/product-lines-form';
import { optionalText } from '@/utils/validation.utils';

export interface OrderFormState {
  readonly clientId: EntityId | null;
  readonly notes: string;
  readonly lines: readonly ProductLineFormValue[];
}

export const EMPTY_ORDER_FORM: OrderFormState = { clientId: null, notes: '', lines: [] };

export function orderDetailToForm(detail: OrderDetail): OrderFormState {
  return {
    clientId: detail.order.clientId,
    notes: detail.order.notes ?? '',
    lines: detail.lines.map(({ item }) => ({
      productId: item.productId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  };
}

/** Valide la saisie ; `nameOf` sert à nommer le produit fautif dans le message d'erreur. */
export function parseOrderForm(state: OrderFormState, nameOf: (productId: EntityId) => string): OrderDraft {
  return {
    clientId: state.clientId,
    notes: optionalText(state.notes),
    lines: parseProductLines(state.lines, nameOf),
  };
}
