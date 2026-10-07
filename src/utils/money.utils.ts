import { CURRENCY } from '@/core/constants/app.constants';
import { Money } from '@/models';

const NBSP = ' ';

/** Formate un montant entier : 125000 -> "125 000 Ar". */
/** Plafond des frais de livraison, aligné sur le serveur (protège d'une faute de frappe). */
export const MAX_DELIVERY_FEE = 1_000_000;

/** Frais de livraison saisis (espaces et points ignorés) ; null si le montant n'est pas valide. */
export function parseDeliveryFee(value: string): number | null {
  const digits = value.replace(/[\s.]/g, '');
  const fee = Number(digits);
  return digits.length === 0 || !Number.isSafeInteger(fee) || fee < 0 || fee > MAX_DELIVERY_FEE ? null : fee;
}

export function formatMoney(amount: Money): string {
  const absolute = Math.abs(Math.trunc(amount));
  const grouped = String(absolute).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${grouped}${NBSP}${CURRENCY.symbol}`;
}
