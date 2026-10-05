import { IsoDateString } from '@/models';

export function nowIso(): IsoDateString {
  return new Date().toISOString();
}

/** 02/10/2026 14:05 */
export function formatDisplayDateTime(iso: IsoDateString): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDisplayDate(iso)} ${hours}:${minutes}`;
}

export function formatDisplayDate(iso: IsoDateString): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Date d'un jour local à midi, en ISO (midi évite qu'un décalage horaire change le jour). */
export function localDayIso(daysAgo = 0, reference: Date = new Date()): IsoDateString {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - daysAgo, 12).toISOString();
}

/** Lit une date saisie « JJ/MM/AAAA » ; null si elle est invalide ou inexistante (31/02…). */
export function parseDisplayDate(text: string): IsoDateString | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (match === null) {
    return null;
  }
  const [, day, month, year] = match.map(Number);
  if (day === undefined || month === undefined || year === undefined) {
    return null;
  }
  const date = new Date(year, month - 1, day, 12);
  const exists = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return exists ? date.toISOString() : null;
}

/** Jour local abrégé pour un axe : « lun. 28 ». */
export function formatShortDay(iso: IsoDateString): string {
  const date = new Date(iso);
  const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  return `${days[date.getDay()] ?? ''} ${date.getDate()}`;
}
