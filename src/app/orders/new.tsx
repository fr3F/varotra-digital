import { useLocalSearchParams } from 'expo-router';
import { OrderFormScreen } from '@/features/orders/OrderFormScreen';

export default function NewOrderRoute() {
  // clientId : client présélectionné (depuis sa fiche).
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  return <OrderFormScreen orderId={null} initialClientId={clientId ?? null} />;
}
