import { BaseEntity, EntityInput, IsoDateString, Money } from './base.model';

export const EXPENSE_CATEGORIES = ['PURCHASE', 'TRANSPORT', 'ADVERTISING', 'SALARY', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Readonly<Record<ExpenseCategory, string>> = {
  PURCHASE: 'Achat marchandise',
  TRANSPORT: 'Transport',
  ADVERTISING: 'Publicité',
  SALARY: 'Salaire',
  OTHER: 'Autres',
};

export interface Expense extends BaseEntity {
  readonly label: string;
  readonly category: ExpenseCategory;
  readonly amount: Money;
  readonly notes: string | null;
  readonly spentAt: IsoDateString;
}

export type ExpenseInput = EntityInput<Expense>;

export interface CategoryTotal {
  readonly category: ExpenseCategory;
  readonly total: Money;
  readonly count: number;
}
