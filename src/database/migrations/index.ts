import { initialSchema } from './001-initial-schema';
import { productImage } from './002-product-image';
import { stockMovementOrigin } from './003-stock-movement-origin';
import { ordersWorkflow } from './004-orders-workflow';
import { salesExpensesSettings } from './005-sales-expenses-settings';
import { messenger } from './006-messenger';
import { messengerReplies } from './007-messenger-replies';
import { notificationInbox } from './008-notification-inbox';
import { orderDelivery } from './009-order-delivery';
import { Migration } from './migration.types';

/** Ajouter chaque nouvelle migration à la fin, sans jamais modifier une migration déjà livrée. */
export const MIGRATIONS: readonly Migration[] = [
  initialSchema,
  productImage,
  stockMovementOrigin,
  ordersWorkflow,
  salesExpensesSettings,
  messenger,
  messengerReplies,
  notificationInbox,
  orderDelivery,
];
