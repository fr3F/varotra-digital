import { defineMessages } from '@/core/i18n/i18n';

/** Textes des notifications locales (lus hors React avec messagesOf). */
interface NotificationsMessages {
  readonly reviewSuffix: string;
  readonly shortageSuffix: string;
  readonly stockOkSuffix: string;
  readonly newMessengerOrder: string;
  readonly newOrder: string;
  readonly orderDelivered: string;
  readonly collected: (amount: string) => string;
  readonly outOfStock: string;
  readonly lowStock: string;
  readonly noLongerAvailable: (product: string) => string;
  readonly lowStockBody: (product: string, available: number, threshold: number) => string;
  readonly syncFailed: string;
  readonly testTitle: string;
  readonly testBody: string;
}

export const notificationsMessages = defineMessages<NotificationsMessages>(
  {
    reviewSuffix: ' · à vérifier',
    shortageSuffix: ' · ⚠️ stock insuffisant',
    stockOkSuffix: ' · stock OK',
    newMessengerOrder: 'Nouvelle commande Messenger',
    newOrder: 'Nouvelle commande',
    orderDelivered: 'Commande livrée',
    collected: (amount) => `${amount} encaissés`,
    outOfStock: 'Rupture de stock',
    lowStock: 'Stock faible',
    noLongerAvailable: (product) => `${product} n’est plus disponible.`,
    lowStockBody: (product, available, threshold) => `${product} : ${available} disponible(s), seuil d’alerte ${threshold}.`,
    syncFailed: 'Échec de la synchronisation',
    testTitle: 'Test : notification',
    testBody: 'Les notifications de Carnet Digital fonctionnent sur cet appareil.',
  },
  {
    mg: {
      reviewSuffix: ' · hojerena',
      shortageSuffix: ' · ⚠️ tsy ampy ny tahiry',
      stockOkSuffix: ' · ampy ny tahiry',
      newMessengerOrder: 'Kaomandy vaovao tamin’ny Messenger',
      newOrder: 'Kaomandy vaovao',
      orderDelivered: 'Kaomandy tonga',
      collected: (amount) => `${amount} voaray`,
      outOfStock: 'Lany ny tahiry',
      lowStock: 'Tahiry efa ho lany',
      noLongerAvailable: (product) => `Lany ny ${product}.`,
      lowStockBody: (product, available, threshold) => `${product} : ${available} sisa, fetra fampitandremana ${threshold}.`,
      syncFailed: 'Tsy nety ny fampifanarahana',
      testTitle: 'Andrana : fampahafantarana',
      testBody: 'Mandeha amin’ity finday ity ny fampahafantarana avy amin’ny Carnet Digital.',
    },
    en: {
      reviewSuffix: ' · to check',
      shortageSuffix: ' · ⚠️ not enough stock',
      stockOkSuffix: ' · stock OK',
      newMessengerOrder: 'New Messenger order',
      newOrder: 'New order',
      orderDelivered: 'Order delivered',
      collected: (amount) => `${amount} collected`,
      outOfStock: 'Out of stock',
      lowStock: 'Low stock',
      noLongerAvailable: (product) => `${product} is no longer available.`,
      lowStockBody: (product, available, threshold) => `${product}: ${available} available, alert level ${threshold}.`,
      syncFailed: 'Sync failed',
      testTitle: 'Test: notification',
      testBody: 'Carnet Digital notifications work on this device.',
    },
  },
);
