import { ValidationError } from '@/core/errors/app-error';
import { createStore } from '@/core/state/store';
import { expenseRepository } from '@/database/repositories/expense.repository';
import { CategoryTotal, EntityId, Expense, ExpenseCategory, ExpenseInput, Period, periodStart } from '@/models';

/** Incrémenté à chaque modification : les écrans (historique, tableau de bord) s'y abonnent. */
export const expensesVersion = createStore(0);

function bump(): void {
  expensesVersion.set((version) => version + 1);
}

function validate(input: ExpenseInput): ExpenseInput {
  if (input.label.trim().length === 0) {
    throw new ValidationError('Le libellé est obligatoire.');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError('Le montant doit être supérieur à zéro.');
  }
  if (Number.isNaN(Date.parse(input.spentAt))) {
    throw new ValidationError('Date de dépense invalide.');
  }
  return { ...input, label: input.label.trim() };
}

/** Sorties d'argent : achats de marchandise, transport, publicité, salaires… */
export const expenseService = {
  list(period: Period, category: ExpenseCategory | null): Promise<Expense[]> {
    return expenseRepository.findFiltered({ since: periodStart(period), category });
  },

  totalsByCategory(period: Period): Promise<CategoryTotal[]> {
    return expenseRepository.totalsByCategory(periodStart(period));
  },

  total(period: Period): Promise<number> {
    return expenseRepository.total(periodStart(period));
  },

  getById(id: EntityId): Promise<Expense> {
    return expenseRepository.getById(id);
  },

  async create(input: ExpenseInput): Promise<Expense> {
    const expense = await expenseRepository.create(validate(input));
    bump();
    return expense;
  },

  async update(id: EntityId, input: ExpenseInput): Promise<Expense> {
    const expense = await expenseRepository.update(id, validate(input));
    bump();
    return expense;
  },

  async remove(id: EntityId): Promise<void> {
    await expenseRepository.softDelete(id);
    bump();
  },
};
