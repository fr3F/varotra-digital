import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import {
  Expense,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  ExpenseCategory,
  Period,
  PERIOD_LABELS,
  PERIODS,
} from '@/models';
import { expenseService, expensesVersion } from '@/services/expense.service';
import { BarList } from '@/shared/components/charts/BarList';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useQuery } from '@/shared/hooks/useQuery';
import { formatDisplayDate } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';

const PERIOD_OPTIONS: readonly ChipOption<Period>[] = PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }));
const CATEGORY_OPTIONS: readonly ChipOption<ExpenseCategory | null>[] = [
  { value: null, label: 'Toutes' },
  ...EXPENSE_CATEGORIES.map((value) => ({ value, label: EXPENSE_CATEGORY_LABELS[value] })),
];

function ExpenseRow({ expense }: { readonly expense: Expense }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/expenses/[id]', params: { id: expense.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.label}
        </Text>
        <Text style={styles.meta}>
          {formatDisplayDate(expense.spentAt)} · {EXPENSE_CATEGORY_LABELS[expense.category]}
        </Text>
      </View>
      <Text style={styles.amount}>−{formatMoney(expense.amount)}</Text>
    </Pressable>
  );
}

export function ExpenseListScreen() {
  const [period, setPeriod] = useState<Period>('MONTH');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const version = useStore(expensesVersion);

  const fetchExpenses = useCallback(
    async () => ({
      expenses: await expenseService.list(period, category),
      byCategory: await expenseService.totalsByCategory(period),
    }),
    [period, category],
  );
  const { data, loading, error, reload } = useQuery(fetchExpenses, version);

  const total = useMemo(() => (data?.expenses ?? []).reduce((sum, expense) => sum + expense.amount, 0), [data]);
  const chartData = useMemo(
    () =>
      (data?.byCategory ?? []).map((entry) => ({
        key: entry.category,
        label: EXPENSE_CATEGORY_LABELS[entry.category],
        value: entry.total,
      })),
    [data],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Dépenses' }} />
      <FlatList
        data={data?.expenses ?? []}
        keyExtractor={(expense) => expense.id}
        renderItem={({ item }) => <ExpenseRow expense={item} />}
        refreshing={loading && data !== null}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.header}>
            <ChipGroup accessibilityLabel="Période" options={PERIOD_OPTIONS} selected={period} onSelect={setPeriod} />
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>
                Total {category === null ? '' : `« ${EXPENSE_CATEGORY_LABELS[category]} » `}· {PERIOD_LABELS[period]}
              </Text>
              <Text style={styles.totalValue}>{formatMoney(total)}</Text>
              <Text style={styles.meta}>{data?.expenses.length ?? 0} dépense(s)</Text>
            </View>
            {chartData.length > 0 && category === null ? (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Répartition par catégorie</Text>
                <BarList data={chartData} formatValue={formatMoney} />
              </View>
            ) : null}
            <ChipGroup
              accessibilityLabel="Filtrer par catégorie"
              options={CATEGORY_OPTIONS}
              selected={category}
              onSelect={setCategory}
            />
            <ErrorBanner message={error} />
          </View>
        }
        ListEmptyComponent={
          data === null ? (
            <LoadingView />
          ) : (
            <EmptyState icon="wallet-outline" title="Aucune dépense" message="Aucune dépense sur cette période." />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  totalCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  totalValue: { marginVertical: spacing.xs, fontSize: fontSize.xxl, fontWeight: '800', color: colors.danger, fontVariant: ['tabular-nums'] },
  chartCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  chartTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.background },
  rowMain: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  amount: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
});
