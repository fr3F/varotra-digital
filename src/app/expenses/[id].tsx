import { useLocalSearchParams } from 'expo-router';
import { ExpenseFormScreen } from '@/features/expenses/ExpenseFormScreen';

export default function EditExpenseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseFormScreen key={id} expenseId={id} />;
}
