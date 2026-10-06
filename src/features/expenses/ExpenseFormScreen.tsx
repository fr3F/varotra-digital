import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '@/models';
import { expenseService } from '@/services/expense.service';
import { AppButton } from '@/shared/components/AppButton';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { useForm } from '@/shared/hooks/useForm';
import { confirmAction } from '@/shared/utils/confirm';
import { goBackOr } from '@/shared/utils/navigation';
import { formatDisplayDate, localDayIso } from '@/utils/date.utils';
import { emptyExpenseForm, expenseToFormValues, parseExpenseForm } from './expense-form';
import { expensesMessages } from './expenses.messages';

/** Correction ou suppression d'une dépense existante (pas de création dans l'application). */
export function ExpenseFormScreen({ expenseId }: { readonly expenseId: string }) {
  const t = useMessages(expensesMessages);
  const common = useMessages(commonMessages);
  const categoryOptions = useMemo<readonly ChipOption<ExpenseCategory>[]>(
    () => EXPENSE_CATEGORIES.map((value) => ({ value, label: common.expenseCategory[value] })),
    [common],
  );
  const quickDates = useMemo<readonly ChipOption<number>[]>(
    () => [
      { value: 0, label: t.today },
      { value: 1, label: t.yesterday },
      { value: 2, label: t.dayBefore },
    ],
    [t],
  );
  const [category, setCategory] = useState<ExpenseCategory>('PURCHASE');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { values, setField, reset } = useForm(emptyExpenseForm());
  const { busy, error, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    expenseService
      .getById(expenseId)
      .then((expense) => {
        if (active) {
          reset(expenseToFormValues(expense));
          setCategory(expense.category);
          setLoaded(true);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setLoadError(toErrorMessage(caught));
        }
      });
    return () => {
      active = false;
    };
  }, [expenseId, reset]);

  const save = () =>
    run(async () => {
      const input = parseExpenseForm(values, category);
      await expenseService.update(expenseId, input);
      goBackOr('/expenses');
    });

  const remove = async () => {
    if (!(await confirmAction(t.deleteTitle, t.deleteMessage, common.actions.delete))) {
      return;
    }
    await run(async () => {
      await expenseService.remove(expenseId);
      goBackOr('/expenses');
    });
  };

  if (!loaded) {
    return loadError === null ? <LoadingView /> : <ErrorBanner message={loadError} />;
  }

  // Raccourci de date sélectionné si la date saisie correspond à l'un d'eux.
  const quickDate = quickDates.find((option) => formatDisplayDate(localDayIso(option.value)) === values.date);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <Stack.Screen options={{ title: t.editTitle }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <Text style={styles.label}>{t.category}</Text>
        <ChipGroup accessibilityLabel={t.category} options={categoryOptions} selected={category} onSelect={setCategory} />
        <View style={styles.spacer} />
        <FormField
          label={t.label}
          required
          value={values.label}
          onChangeText={(v) => setField('label', v)}
          placeholder={t.labelPlaceholder}
        />
        <FormField
          label={t.amount}
          required
          keyboardType="number-pad"
          value={values.amount}
          onChangeText={(v) => setField('amount', v)}
        />
        <FormField
          label={t.date}
          required
          value={values.date}
          onChangeText={(v) => setField('date', v)}
          placeholder={t.datePlaceholder}
          keyboardType="numbers-and-punctuation"
        />
        <ChipGroup
          accessibilityLabel={t.quickDate}
          options={quickDates}
          selected={quickDate?.value ?? -1}
          onSelect={(daysAgo) => setField('date', formatDisplayDate(localDayIso(daysAgo)))}
        />
        <View style={styles.spacer} />
        <FormField label={t.notes} multiline value={values.notes} onChangeText={(v) => setField('notes', v)} />
        <View style={styles.actions}>
          <AppButton label={common.actions.save} onPress={() => void save()} loading={busy} />
          <AppButton label={common.actions.delete} variant="danger" onPress={() => void remove()} disabled={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  spacer: { height: spacing.lg },
  actions: { gap: spacing.md },
});
