import { useLocalSearchParams } from 'expo-router';
import { OrderFormScreen } from '@/features/orders/OrderFormScreen';

export default function EditOrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderFormScreen key={id} orderId={id} />;
}
