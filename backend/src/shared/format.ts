const NBSP = ' ';

/** 19000 -> "19 000 Ar" (même format que l'application). */
export function formatMoney(amount: number): string {
  const grouped = String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${amount < 0 ? '-' : ''}${grouped}${NBSP}Ar`;
}

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Tronque à `max` caractères (titres des réponses rapides Messenger : 20 maximum). */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Préfixe de référence du jour : MSG-20261004-. */
export function dayPrefix(kind: string, date: Date): string {
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${kind}-${day}-`;
}
