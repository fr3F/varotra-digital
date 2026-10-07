import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { Expense, EXPENSE_CATEGORIES, ExpenseCategory, Period, PERIODS } from '@/models';
import { expenseService, expensesVersion } from '@/services/expense.service';
import { BarList } from '@/shared/components/charts/BarList';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useQuery } from '@/shared/hooks/useQuery';
import { formatDisplayDate } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { expensesMessages } from './expenses.messages';

function ExpenseRow({ expense }: { readonly expense: Expense }) {
  const common = useMessages(commonMessages);
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
          {formatDisplayDate(expense.spentAt)} · {common.expenseCategory[expense.category]}
        </Text>
      </View>
      <Text style={styles.amount}>−{formatMoney(expense.amount)}</Text>
    </Pressable>
  );
}

export function ExpenseListScreen() {
  const t = useMessages(expensesMessages);
  const common = useMessages(commonMessages);
  const periodOptions = useMemo<readonly ChipOption<Period>[]>(
    () => PERIODS.map((value) => ({ value, label: common.period[value] })),
    [common],
  );
  const categoryOptions = useMemo<readonly ChipOption<ExpenseCategory | null>[]>(
    () => [
      { value: null, label: t.allCategories },
      ...EXPENSE_CATEGORIES.map((value) => ({ value, label: common.expenseCategory[value] })),
    ],
    [t, common],
  );
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
        label: common.expenseCategory[entry.category],
        value: entry.total,
      })),
    [data, common],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t.title }} />
      <FlatList
        data={data?.expenses ?? []}
        keyExtractor={(expense) => expense.id}
        renderItem={({ item }) => <ExpenseRow expense={item} />}
        refreshing={loading && data !== null}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.header}>
            <ChipGroup accessibilityLabel={t.periodLabel} options={periodOptions} selected={period} onSelect={setPeriod} />
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>
                {t.totalLabel(category === null ? null : common.expenseCategory[category], common.period[period])}
              </Text>
              <Text style={styles.totalValue}>{formatMoney(total)}</Text>
              <Text style={styles.meta}>{t.expenseCount(data?.expenses.length ?? 0)}</Text>
            </View>
            {chartData.length > 0 && category === null ? (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>{t.byCategory}</Text>
                <BarList data={chartData} formatValue={formatMoney} />
              </View>
            ) : null}
            <ChipGroup
              accessibilityLabel={t.filterByCategory}
              options={categoryOptions}
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
            <EmptyState icon="wallet-outline" title={t.emptyTitle} message={t.emptyMessage} />
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
