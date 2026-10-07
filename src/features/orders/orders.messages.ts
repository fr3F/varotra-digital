import { defineMessages } from '@/core/i18n/i18n';
import type { OrderStatus } from '@/models';

/** Textes des écrans de commandes (liste, détail, correction, badges Messenger). */
interface OrdersMessages {
  readonly title: string;
  readonly editTitle: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly filterByStatus: string;
  readonly allCount: (count: number) => string;
  readonly statusCount: (label: string, count: number) => string;
  readonly notFound: string;
  readonly empty: string;
  readonly emptyMessage: string;
  readonly productCount: (count: number) => string;
  /** Libellé du bouton qui fait passer la commande vers ce statut. */
  readonly actionLabels: Readonly<Record<OrderStatus, string>>;
  /** Confirmation des actions aux conséquences importantes. */
  readonly actionConfirmations: Partial<Readonly<Record<OrderStatus, string>>>;
  readonly deleteTitle: string;
  readonly deleteReserved: string;
  readonly deleteForever: string;
  readonly adjustTitle: string;
  readonly adjustMessage: string;
  readonly adjustConfirm: string;
  readonly orderedOn: (date: string) => string;
  readonly stockReserved: string;
  readonly client: string;
  readonly viewClient: string;
  readonly notes: string;
  readonly products: string;
  readonly totalAmount: string;
  readonly shortageTitle: string;
  readonly shortageMessage: string;
  readonly shortageLine: (product: string, requested: number, available: number) => string;
  readonly addStock: (product: string) => string;
  readonly adjustButton: string;
  readonly changeStatus: string;
  readonly editOrder: string;
  readonly deleteOrder: string;
  readonly history: string;
  readonly created: (status: string) => string;
  readonly notEditableTitle: (status: string) => string;
  readonly notEditableMessage: string;
  readonly notesPlaceholder: string;
  readonly saveChanges: string;
  readonly unnamedProduct: string;
  readonly badgeMessenger: string;
  readonly badgeReview: string;
  readonly badgeStockOk: string;
  readonly badgeShortage: string;
  readonly messengerTitle: string;
  readonly messengerReview: string;
  readonly messengerShortage: string;
  readonly customerMessage: string;
  readonly facebookReplies: string;
}

export const ordersMessages = defineMessages<OrdersMessages>(
  {
    title: 'Commandes',
    editTitle: 'Modifier la commande',
    searchLabel: 'Rechercher une commande',
    searchPlaceholder: 'Rechercher (référence, client)',
    filterByStatus: 'Filtrer par statut',
    allCount: (count) => `Toutes (${count})`,
    statusCount: (label, count) => `${label} (${count})`,
    notFound: 'Aucune commande trouvée',
    empty: 'Aucune commande',
    emptyMessage: 'Les commandes reçues sur Messenger apparaissent ici automatiquement.',
    productCount: (count) => `${count} produit(s)`,
    actionLabels: {
      NEW: 'Repasser en « Nouvelle »',
      PREPARING: 'Passer en préparation',
      CONFIRMED: 'Valider (réserver le stock)',
      DELIVERED: 'Marquer comme livrée',
      CANCELLED: 'Annuler la commande',
    },
    actionConfirmations: {
      CONFIRMED: 'Le stock disponible sera vérifié et les quantités réservées pour cette commande.',
      DELIVERED: 'Les quantités réservées sortiront définitivement du stock. Cette action est définitive.',
      CANCELLED: 'La commande sera annulée et sa réservation de stock libérée. Cette action est définitive.',
    },
    deleteTitle: 'Supprimer la commande',
    deleteReserved: 'La commande sera supprimée et son stock réservé libéré.',
    deleteForever: 'Supprimer définitivement cette commande ?',
    adjustTitle: 'Ajuster au stock disponible',
    adjustMessage: 'Les quantités seront ramenées au stock disponible (produits épuisés retirés de la commande).',
    adjustConfirm: 'Ajuster',
    orderedOn: (date) => `Commandée le ${date}`,
    stockReserved: 'Stock réservé pour cette commande',
    client: 'Client',
    viewClient: 'Voir la fiche client',
    notes: 'Notes',
    products: 'Produits',
    totalAmount: 'Montant total',
    shortageTitle: 'Stock insuffisant',
    shortageMessage: 'La commande ne peut pas être validée tant que le stock ne suffit pas.',
    shortageLine: (product, requested, available) =>
      `${product} : ${requested} demandé(s), ${available > 0 ? `${available} disponible(s)` : 'épuisé'}`,
    addStock: (product) => `Ajouter du stock (${product})`,
    adjustButton: 'Ajuster au stock disponible',
    changeStatus: 'Changer le statut',
    editOrder: 'Modifier la commande',
    deleteOrder: 'Supprimer la commande',
    history: 'Historique',
    created: (status) => `Créée (${status})`,
    notEditableTitle: (status) => `Commande « ${status} »`,
    notEditableMessage: 'Elle ne peut plus être modifiée. Remettez-la en préparation depuis son détail pour changer ses produits.',
    notesPlaceholder: 'Adresse de livraison, créneau, remarque…',
    saveChanges: 'Enregistrer les modifications',
    unnamedProduct: 'produit',
    badgeMessenger: 'Messenger',
    badgeReview: 'À vérifier',
    badgeStockOk: 'Stock OK',
    badgeShortage: 'Stock insuffisant',
    messengerTitle: 'Commande reçue via Messenger',
    messengerReview: 'À vérifier : complétez ou corrigez les produits avec « Modifier la commande », puis validez-la.',
    messengerShortage: 'Stock insuffisant pour au moins un produit : la validation sera refusée.',
    customerMessage: 'Message du client',
    facebookReplies: 'Réponses Facebook',
  },
  {
    mg: {
      title: 'Kaomandy',
      editTitle: 'Hanova ny kaomandy',
      searchLabel: 'Hitady kaomandy',
      searchPlaceholder: 'Hitady (laharana, mpividy)',
      filterByStatus: 'Sivanina araka ny sata',
      allCount: (count) => `Rehetra (${count})`,
      statusCount: (label, count) => `${label} (${count})`,
      notFound: 'Tsy misy kaomandy hita',
      empty: 'Mbola tsy misy kaomandy',
      emptyMessage: 'Miseho ho azy eto ny kaomandy tonga avy amin’ny Messenger.',
      productCount: (count) => `entana ${count}`,
      actionLabels: {
        NEW: 'Averina ho « Vaovao »',
        PREPARING: 'Atomboka ny fanomanana',
        CONFIRMED: 'Hamafisina (atokana ny tahiry)',
        DELIVERED: 'Tonga any amin’ny mpividy',
        CANCELLED: 'Foanana ny kaomandy',
      },
      actionConfirmations: {
        CONFIRMED: 'Hojerena ny tahiry misy ary hatokana ho an’ity kaomandy ity ny isan’ny entana.',
        DELIVERED: 'Hiala tanteraka amin’ny tahiry ny entana natokana. Tsy azo averina io.',
        CANCELLED: 'Hofoanana ny kaomandy ary hiverina ao amin’ny tahiry ny entana natokana. Tsy azo averina io.',
      },
      deleteTitle: 'Hamafa ny kaomandy',
      deleteReserved: 'Hofafana ny kaomandy ary hiverina ao amin’ny tahiry ny entana natokana.',
      deleteForever: 'Hofafana tanteraka ve ity kaomandy ity ?',
      adjustTitle: 'Ampifanaraho amin’ny tahiry',
      adjustMessage: 'Hampihenana araka ny tahiry misy ny isa (esorina ny entana lany).',
      adjustConfirm: 'Ampifanaraho',
      orderedOn: (date) => `Nafarana ny ${date}`,
      stockReserved: 'Voatokana ho an’ity kaomandy ity ny tahiry',
      client: 'Mpividy',
      viewClient: 'Hijery ny momba ny mpividy',
      notes: 'Fanamarihana',
      products: 'Entana',
      totalAmount: 'Vola rehetra',
      shortageTitle: 'Tsy ampy ny tahiry',
      shortageMessage: 'Tsy azo hamafisina ny kaomandy raha mbola tsy ampy ny tahiry.',
      shortageLine: (product, requested, available) =>
        `${product} : ${requested} nangatahina, ${available > 0 ? `${available} no misy` : 'lany'}`,
      addStock: (product) => `Ampitomboy ny tahiry (${product})`,
      adjustButton: 'Ampifanaraho amin’ny tahiry misy',
      changeStatus: 'Hanova ny sata',
      editOrder: 'Hanova ny kaomandy',
      deleteOrder: 'Hamafa ny kaomandy',
      history: 'Tantara',
      created: (status) => `Noforonina (${status})`,
      notEditableTitle: (status) => `Kaomandy « ${status} »`,
      notEditableMessage: 'Tsy azo ovaina intsony izy. Avereno amin’ny fanomanana avy amin’ny antsipiriany raha hanova ny entana.',
      notesPlaceholder: 'Adiresy fanaterana, ora, fanamarihana…',
      saveChanges: 'Tehirizina ny fanovana',
      unnamedProduct: 'entana',
      badgeMessenger: 'Messenger',
      badgeReview: 'Hojerena',
      badgeStockOk: 'Ampy ny tahiry',
      badgeShortage: 'Tsy ampy ny tahiry',
      messengerTitle: 'Kaomandy tonga tamin’ny Messenger',
      messengerReview: 'Hojerena : fenoy na ahitsio ny entana amin’ny « Hanova ny kaomandy », avy eo hamafiso.',
      messengerShortage: 'Tsy ampy ny tahirin’ny entana iray farafahakeliny : tsy ho azo hamafisina.',
      customerMessage: 'Hafatry ny mpividy',
      facebookReplies: 'Valiny tamin’ny Facebook',
    },
    en: {
      title: 'Orders',
      editTitle: 'Edit order',
      searchLabel: 'Search an order',
      searchPlaceholder: 'Search (reference, customer)',
      filterByStatus: 'Filter by status',
      allCount: (count) => `All (${count})`,
      statusCount: (label, count) => `${label} (${count})`,
      notFound: 'No order found',
      empty: 'No orders',
      emptyMessage: 'Orders received on Messenger show up here automatically.',
      productCount: (count) => `${count} product(s)`,
      actionLabels: {
        NEW: 'Back to “New”',
        PREPARING: 'Start preparing',
        CONFIRMED: 'Confirm (reserve stock)',
        DELIVERED: 'Mark as delivered',
        CANCELLED: 'Cancel order',
      },
      actionConfirmations: {
        CONFIRMED: 'Available stock will be checked and the quantities reserved for this order.',
        DELIVERED: 'The reserved quantities will leave the stock for good. This cannot be undone.',
        CANCELLED: 'The order will be cancelled and its stock reservation released. This cannot be undone.',
      },
      deleteTitle: 'Delete order',
      deleteReserved: 'The order will be deleted and its reserved stock released.',
      deleteForever: 'Delete this order permanently?',
      adjustTitle: 'Adjust to available stock',
      adjustMessage: 'Quantities will be reduced to the available stock (sold-out products removed from the order).',
      adjustConfirm: 'Adjust',
      orderedOn: (date) => `Ordered on ${date}`,
      stockReserved: 'Stock reserved for this order',
      client: 'Customer',
      viewClient: 'View customer',
      notes: 'Notes',
      products: 'Products',
      totalAmount: 'Total amount',
      shortageTitle: 'Not enough stock',
      shortageMessage: 'The order cannot be confirmed until there is enough stock.',
      shortageLine: (product, requested, available) =>
        `${product}: ${requested} requested, ${available > 0 ? `${available} available` : 'sold out'}`,
      addStock: (product) => `Add stock (${product})`,
      adjustButton: 'Adjust to available stock',
      changeStatus: 'Change status',
      editOrder: 'Edit order',
      deleteOrder: 'Delete order',
      history: 'History',
      created: (status) => `Created (${status})`,
      notEditableTitle: (status) => `“${status}” order`,
      notEditableMessage: 'It can no longer be edited. Move it back to preparing from its details to change its products.',
      notesPlaceholder: 'Delivery address, time slot, remark…',
      saveChanges: 'Save changes',
      unnamedProduct: 'product',
      badgeMessenger: 'Messenger',
      badgeReview: 'To check',
      badgeStockOk: 'Stock OK',
      badgeShortage: 'Low stock',
      messengerTitle: 'Order received via Messenger',
      messengerReview: 'To check: complete or fix the products with “Edit order”, then confirm it.',
      messengerShortage: 'Not enough stock for at least one product: confirmation will be refused.',
      customerMessage: 'Customer message',
      facebookReplies: 'Facebook replies',
    },
  },
);
