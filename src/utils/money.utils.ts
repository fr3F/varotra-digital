import { CURRENCY } from '@/core/constants/app.constants';
import { Money } from '@/models';

const NBSP = ' ';

/** Formate un montant entier : 125000 -> "125 000 Ar". */
export function formatMoney(amount: Money): string {
  const absolute = Math.abs(Math.trunc(amount));
  const grouped = String(absolute).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${grouped}${NBSP}${CURRENCY.symbol}`;
}
