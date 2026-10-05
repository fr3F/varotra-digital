import { randomUUID } from 'expo-crypto';
import { EntityId } from '@/models';

export function generateId(): EntityId {
  return randomUUID();
}
