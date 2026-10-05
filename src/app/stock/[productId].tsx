import { useLocalSearchParams } from 'expo-router';
import { StockDetailScreen } from '@/features/stock/StockDetailScreen';

export default function StockProductRoute() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return <StockDetailScreen key={productId} productId={productId} />;
}
