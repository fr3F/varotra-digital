import { useLocalSearchParams } from 'expo-router';
import { NEW_ENTITY_ID } from '@/core/constants/app.constants';
import { ProductFormScreen } from '@/features/products/ProductFormScreen';

export default function ProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductFormScreen key={id} productId={id === NEW_ENTITY_ID ? null : id} />;
}
