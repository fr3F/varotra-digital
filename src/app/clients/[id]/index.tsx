import { useLocalSearchParams } from 'expo-router';
import { ClientDetailScreen } from '@/features/clients/ClientDetailScreen';

export default function ClientDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClientDetailScreen key={id} clientId={id} />;
}
