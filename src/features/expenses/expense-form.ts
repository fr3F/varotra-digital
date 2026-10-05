import { ValidationError } from '@/core/errors/app-error';
import { Expense, ExpenseCategory, ExpenseInput } from '@/models';
import { formatDisplayDate, localDayIso, parseDisplayDate } from '@/utils/date.utils';
import { optionalText, parsePositiveInteger, requireText } from '@/utils/validation.utils';

export type ExpenseFormValues = {
  readonly label: string;
  readonly amount: string;
  readonly date: string;
  readonly notes: string;
};

export function emptyExpenseForm(): ExpenseFormValues {
  return { label: '', amount: '', date: formatDisplayDate(localDayIso()), notes: '' };
}

export function expenseToFormValues(expense: Expense): ExpenseFormValues {
  return {
    label: expense.label,
    amount: String(expense.amount),
    date: formatDisplayDate(expense.spentAt),
    notes: expense.notes ?? '',
  };
}

export function parseExpenseForm(values: ExpenseFormValues, category: ExpenseCategory): ExpenseInput {
  const spentAt = parseDisplayDate(values.date);
  if (spentAt === null) {
    throw new ValidationError('Date invalide : utilisez le format JJ/MM/AAAA.');
  }
  // Les dates sont enregistrées à midi : au-delà de midi aujourd'hui, c'est un jour futur.
  if (spentAt > localDayIso(0)) {
    throw new ValidationError('La date ne peut pas être dans le futur.');
  }
  return {
    label: requireText(values.label, 'Libellé'),
    amount: parsePositiveInteger(values.amount, 'Montant'),
    category,
    notes: optionalText(values.notes),
    spentAt,
  };
}
