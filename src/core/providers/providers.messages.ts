import { defineMessages } from '@/core/i18n/i18n';

/**
 * Textes affichés avant l'ouverture de la base (la langue est alors celle du téléphone,
 * la langue choisie dans les réglages n'étant pas encore lue).
 */
export const providersMessages = defineMessages(
  {
    databaseError: 'Impossible d\'ouvrir les données',
    retry: 'Réessayer',
    otherTabTitle: 'Carnet Digital est déjà ouvert dans un autre onglet',
    otherTabMessage: 'Fermez l\'autre onglet : cette page prendra le relais automatiquement.',
  },
  {
    mg: {
      databaseError: 'Tsy voasokatra ny angona',
      retry: 'Averina',
      otherTabTitle: 'Efa misokatra amin’ny tabilao hafa ny Carnet Digital',
      otherTabMessage: 'Akatony ilay tabilao hafa : handray ny asa ho azy ity pejy ity.',
    },
    en: {
      databaseError: 'Unable to open the data',
      retry: 'Retry',
      otherTabTitle: 'Carnet Digital is already open in another tab',
      otherTabMessage: 'Close the other tab: this page will take over automatically.',
    },
  },
);
