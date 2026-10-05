import { IsoDateString } from './base.model';

export const PERIODS = ['TODAY', 'WEEK', 'MONTH', 'ALL'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Readonly<Record<Period, string>> = {
  TODAY: 'Aujourd’hui',
  WEEK: '7 jours',
  MONTH: 'Ce mois',
  ALL: 'Tout',
};

/** Début de la période en ISO UTC (jours locaux), ou null pour « Tout ». */
export function periodStart(period: Period, reference: Date = new Date()): IsoDateString | null {
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  switch (period) {
    case 'TODAY':
      return today.toISOString();
    case 'WEEK':
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString();
    case 'MONTH':
      return new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    case 'ALL':
      return null;
  }
}
