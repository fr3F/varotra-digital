import { useLocalSearchParams } from 'expo-router';
import { ClientFormScreen } from '@/features/clients/ClientFormScreen';

export default function EditClientRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClientFormScreen key={id} clientId={id} />;
}
