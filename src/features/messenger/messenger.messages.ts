import { defineMessages } from '@/core/i18n/i18n';

/** Textes de l'historique des réponses Facebook. */
interface MessengerMessages {
  readonly title: string;
  readonly filterAll: string;
  readonly filterAuto: string;
  readonly filterManual: string;
  readonly filterProblem: string;
  readonly filterLabel: string;
  readonly confirmedAuto: string;
  readonly unavailable: string;
  readonly pending: (count: number) => string;
  readonly messengerClient: string;
  readonly empty: string;
  readonly emptyMessage: string;
  readonly originAuto: string;
  readonly originSeller: string;
  readonly waitingNetwork: string;
}

export const messengerMessages = defineMessages<MessengerMessages>(
  {
    title: 'Réponses Facebook',
    filterAll: 'Toutes',
    filterAuto: 'Automatiques',
    filterManual: 'Vendeur',
    filterProblem: 'Non envoyées',
    filterLabel: 'Filtrer les réponses',
    confirmedAuto: 'Confirmées auto.',
    unavailable: 'Indisponibles',
    pending: (count) => `${count} réponse(s) en attente de réseau.`,
    messengerClient: 'Client Messenger',
    empty: 'Aucune réponse',
    emptyMessage: 'Les réponses envoyées aux clients Messenger (automatiques ou non) apparaîtront ici.',
    originAuto: 'Auto',
    originSeller: 'Vendeur',
    waitingNetwork: 'En attente d’envoi (réseau)',
  },
  {
    mg: {
      title: 'Valiny tamin’ny Facebook',
      filterAll: 'Rehetra',
      filterAuto: 'Mandeha ho azy',
      filterManual: 'Mpivarotra',
      filterProblem: 'Tsy lasa',
      filterLabel: 'Sivanina ny valiny',
      confirmedAuto: 'Voamafy ho azy',
      unavailable: 'Tsy misy entana',
      pending: (count) => `Valiny ${count} miandry tambajotra.`,
      messengerClient: 'Mpividy Messenger',
      empty: 'Mbola tsy misy valiny',
      emptyMessage: 'Hiseho eto ny valiny nalefa tamin’ny mpividy Messenger (ho azy na tsia).',
      originAuto: 'Ho azy',
      originSeller: 'Mpivarotra',
      waitingNetwork: 'Miandry tambajotra vao lasa',
    },
    en: {
      title: 'Facebook replies',
      filterAll: 'All',
      filterAuto: 'Automatic',
      filterManual: 'Seller',
      filterProblem: 'Not sent',
      filterLabel: 'Filter replies',
      confirmedAuto: 'Auto-confirmed',
      unavailable: 'Unavailable',
      pending: (count) => `${count} reply(ies) waiting for network.`,
      messengerClient: 'Messenger customer',
      empty: 'No replies',
      emptyMessage: 'Replies sent to Messenger customers (automatic or not) will appear here.',
      originAuto: 'Auto',
      originSeller: 'Seller',
      waitingNetwork: 'Waiting to send (network)',
    },
  },
);
