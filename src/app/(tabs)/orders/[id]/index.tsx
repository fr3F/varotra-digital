import { useLocalSearchParams } from 'expo-router';
import { OrderDetailScreen } from '@/features/orders/OrderDetailScreen';

export default function OrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetailScreen key={id} orderId={id} />;
}
