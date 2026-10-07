import type {
  CustomerReplyKind,
  CustomerReplyResult,
  ExpenseCategory,
  NotificationType,
  OrderStatus,
  PaymentMethod,
  Period,
  StockMovementType,
} from '@/models';
import { defineMessages } from './i18n';

type Labels<K extends string> = Readonly<Record<K, string>>;

/** Textes partagés par plusieurs écrans : boutons, onglets, statuts, catégories. */
interface CommonMessages {
  readonly actions: {
    readonly save: string;
    readonly edit: string;
    readonly delete: string;
    readonly cancel: string;
    readonly confirm: string;
    readonly close: string;
    readonly retry: string;
    readonly continue: string;
    readonly search: string;
    readonly clearSearch: string;
  };
  readonly tabs: {
    readonly home: string;
    readonly orders: string;
    readonly products: string;
    readonly sales: string;
    readonly settings: string;
  };
  readonly loading: string;
  readonly noClient: string;
  readonly all: string;
  readonly orderStatus: Labels<OrderStatus>;
  readonly period: Labels<Period>;
  readonly paymentMethod: Labels<PaymentMethod>;
  readonly expenseCategory: Labels<ExpenseCategory>;
  readonly movementType: Labels<StockMovementType>;
  readonly notificationType: Labels<NotificationType>;
  readonly customerReply: Labels<CustomerReplyKind>;
  readonly customerReplyResult: Labels<CustomerReplyResult>;
}

export const commonMessages = defineMessages<CommonMessages>(
  {
    actions: {
      save: 'Enregistrer',
      edit: 'Modifier',
      delete: 'Supprimer',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      close: 'Fermer',
      retry: 'Réessayer',
      continue: 'Continuer',
      search: 'Rechercher',
      clearSearch: 'Effacer la recherche',
    },
    tabs: { home: 'Accueil', orders: 'Commandes', products: 'Produits', sales: 'Ventes', settings: 'Réglages' },
    loading: 'Chargement…',
    noClient: 'Client non renseigné',
    all: 'Tout',
    orderStatus: { NEW: 'Nouvelle', PREPARING: 'Préparation', CONFIRMED: 'Confirmée', DELIVERED: 'Livrée', CANCELLED: 'Annulée' },
    period: { TODAY: 'Aujourd’hui', WEEK: '7 jours', MONTH: 'Ce mois', ALL: 'Tout' },
    paymentMethod: { CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money', CARD: 'Carte', CREDIT: 'À crédit' },
    expenseCategory: {
      PURCHASE: 'Achat marchandise',
      TRANSPORT: 'Transport',
      ADVERTISING: 'Publicité',
      SALARY: 'Salaire',
      OTHER: 'Autres',
    },
    movementType: { IN: 'Entrée', OUT: 'Sortie', ADJUSTMENT: 'Ajustement' },
    notificationType: {
      NEW_ORDER: 'Nouvelle commande',
      LOW_STOCK: 'Stock faible',
      ORDER_COMPLETED: 'Commande terminée',
      SYNC_ERROR: 'Erreur de synchronisation',
    },
    customerReply: {
      CONFIRMED: 'Commande confirmée',
      UNAVAILABLE: 'Produit indisponible',
      PREPARING: 'En préparation',
      DELIVERED: 'Livrée',
      CANCELLED: 'Annulée',
      MANUAL: 'Message du vendeur',
      DELIVERY_FEE: 'Frais de livraison',
    },
    customerReplyResult: {
      DELIVERED: 'Envoyée sur Messenger',
      OUTSIDE_WINDOW: 'Non envoyée : plus de 24 h depuis son dernier message, contactez-le directement',
      SEND_FAILED: 'Échec de l’envoi Messenger',
      UNKNOWN_ORDER: 'Commande inconnue du serveur',
    },
  },
  {
    mg: {
      actions: {
        save: 'Tehirizina',
        edit: 'Ovaina',
        delete: 'Fafana',
        cancel: 'Foanana',
        confirm: 'Hamafisina',
        close: 'Akatona',
        retry: 'Averina',
        continue: 'Tohizana',
        search: 'Hikaroka',
        clearSearch: 'Fafana ny fikarohana',
      },
      tabs: { home: 'Fandraisana', orders: 'Kaomandy', products: 'Entana', sales: 'Varotra', settings: 'Fikirana' },
      loading: 'Andrasana kely…',
      noClient: 'Tsy voatondro ny mpividy',
      all: 'Rehetra',
      orderStatus: { NEW: 'Vaovao', PREPARING: 'Fanomanana', CONFIRMED: 'Voamafy', DELIVERED: 'Tonga', CANCELLED: 'Nofoanana' },
      period: { TODAY: 'Anio', WEEK: '7 andro', MONTH: 'Ity volana ity', ALL: 'Rehetra' },
      paymentMethod: { CASH: 'Vola an-tanana', MOBILE_MONEY: 'Mobile Money', CARD: 'Karatra', CREDIT: 'Trosa' },
      expenseCategory: {
        PURCHASE: 'Fividianana entana',
        TRANSPORT: 'Fitaterana',
        ADVERTISING: 'Dokam-barotra',
        SALARY: 'Karama',
        OTHER: 'Hafa',
      },
      movementType: { IN: 'Fidirana', OUT: 'Fivoahana', ADJUSTMENT: 'Fanitsiana' },
      notificationType: {
        NEW_ORDER: 'Kaomandy vaovao',
        LOW_STOCK: 'Tahiry efa ho lany',
        ORDER_COMPLETED: 'Kaomandy vita',
        SYNC_ERROR: 'Olana amin’ny fampifanarahana',
      },
      customerReply: {
        CONFIRMED: 'Kaomandy voamafy',
        UNAVAILABLE: 'Entana tsy misy',
        PREPARING: 'Eo am-panomanana',
        DELIVERED: 'Tonga',
        CANCELLED: 'Nofoanana',
        MANUAL: 'Hafatry ny mpivarotra',
        DELIVERY_FEE: 'Saran’ny fanaterana',
      },
      customerReplyResult: {
        DELIVERED: 'Lasa tamin’ny Messenger',
        OUTSIDE_WINDOW: 'Tsy lasa : mihoatra ny 24 ora taorian’ny hafany farany, antsoy mivantana izy',
        SEND_FAILED: 'Tsy lasa tamin’ny Messenger',
        UNKNOWN_ORDER: 'Kaomandy tsy fantatry ny mpizara',
      },
    },
    en: {
      actions: {
        save: 'Save',
        edit: 'Edit',
        delete: 'Delete',
        cancel: 'Cancel',
        confirm: 'Confirm',
        close: 'Close',
        retry: 'Retry',
        continue: 'Continue',
        search: 'Search',
        clearSearch: 'Clear search',
      },
      tabs: { home: 'Home', orders: 'Orders', products: 'Products', sales: 'Sales', settings: 'Settings' },
      loading: 'Loading…',
      noClient: 'No customer',
      all: 'All',
      orderStatus: { NEW: 'New', PREPARING: 'Preparing', CONFIRMED: 'Confirmed', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' },
      period: { TODAY: 'Today', WEEK: '7 days', MONTH: 'This month', ALL: 'All' },
      paymentMethod: { CASH: 'Cash', MOBILE_MONEY: 'Mobile Money', CARD: 'Card', CREDIT: 'On credit' },
      expenseCategory: {
        PURCHASE: 'Stock purchase',
        TRANSPORT: 'Transport',
        ADVERTISING: 'Advertising',
        SALARY: 'Salary',
        OTHER: 'Other',
      },
      movementType: { IN: 'In', OUT: 'Out', ADJUSTMENT: 'Adjustment' },
      notificationType: {
        NEW_ORDER: 'New order',
        LOW_STOCK: 'Low stock',
        ORDER_COMPLETED: 'Order completed',
        SYNC_ERROR: 'Sync error',
      },
      customerReply: {
        CONFIRMED: 'Order confirmed',
        UNAVAILABLE: 'Product unavailable',
        PREPARING: 'Being prepared',
        DELIVERED: 'Delivered',
        CANCELLED: 'Cancelled',
        MANUAL: 'Message from the seller',
        DELIVERY_FEE: 'Delivery fee',
      },
      customerReplyResult: {
        DELIVERED: 'Sent on Messenger',
        OUTSIDE_WINDOW: 'Not sent: more than 24 h since their last message, contact them directly',
        SEND_FAILED: 'Messenger sending failed',
        UNKNOWN_ORDER: 'Order unknown to the server',
      },
    },
  },
);
