import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, ExpenseCategory } from '@/models';
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

const CATEGORY_OPTIONS: readonly ChipOption<ExpenseCategory>[] = EXPENSE_CATEGORIES.map((value) => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}));

const QUICK_DATES: readonly ChipOption<number>[] = [
  { value: 0, label: 'Aujourd’hui' },
  { value: 1, label: 'Hier' },
  { value: 2, label: 'Avant-hier' },
];

export function ExpenseFormScreen({ expenseId }: { readonly expenseId: string | null }) {
  const isNew = expenseId === null;
  const [category, setCategory] = useState<ExpenseCategory>('PURCHASE');
  const [loaded, setLoaded] = useState(isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { values, setField, reset } = useForm(emptyExpenseForm());
  const { busy, error, run } = useAsyncAction();

  useEffect(() => {
    if (expenseId === null) {
      return;
    }
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
      if (expenseId === null) {
        await expenseService.create(input);
      } else {
        await expenseService.update(expenseId, input);
      }
      goBackOr('/expenses');
    });

  const remove = async () => {
    if (expenseId === null || !(await confirmAction('Supprimer', 'Supprimer cette dépense ?', 'Supprimer'))) {
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
  const quickDate = QUICK_DATES.find((option) => formatDisplayDate(localDayIso(option.value)) === values.date);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <Stack.Screen options={{ title: isNew ? 'Nouvelle dépense' : 'Modifier la dépense' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <Text style={styles.label}>Catégorie</Text>
        <ChipGroup accessibilityLabel="Catégorie" options={CATEGORY_OPTIONS} selected={category} onSelect={setCategory} />
        <View style={styles.spacer} />
        <FormField
          label="Libellé"
          required
          value={values.label}
          onChangeText={(v) => setField('label', v)}
          placeholder="Ex. Réassort savon, taxi-moto, boost Facebook…"
        />
        <FormField
          label="Montant (Ar)"
          required
          keyboardType="number-pad"
          value={values.amount}
          onChangeText={(v) => setField('amount', v)}
        />
        <FormField
          label="Date"
          required
          value={values.date}
          onChangeText={(v) => setField('date', v)}
          placeholder="JJ/MM/AAAA"
          keyboardType="numbers-and-punctuation"
        />
        <ChipGroup
          accessibilityLabel="Date rapide"
          options={QUICK_DATES}
          selected={quickDate?.value ?? -1}
          onSelect={(daysAgo) => setField('date', formatDisplayDate(localDayIso(daysAgo)))}
        />
        <View style={styles.spacer} />
        <FormField label="Notes" multiline value={values.notes} onChangeText={(v) => setField('notes', v)} />
        <View style={styles.actions}>
          <AppButton label={isNew ? 'Ajouter la dépense' : 'Enregistrer'} onPress={() => void save()} loading={busy} />
          {!isNew ? (
            <AppButton label="Supprimer" variant="danger" onPress={() => void remove()} disabled={busy} />
          ) : null}
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
