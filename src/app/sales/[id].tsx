import { useLocalSearchParams } from 'expo-router';
import { SaleDetailScreen } from '@/features/sales/SaleDetailScreen';

export default function SaleDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SaleDetailScreen key={id} saleId={id} />;
}
