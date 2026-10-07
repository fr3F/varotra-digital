import { defineMessages } from '@/core/i18n/i18n';

interface OnboardingStep {
  readonly title: string;
  readonly text: string;
}

/** Guide affiché une seule fois, au premier lancement après l'installation. */
interface OnboardingMessages {
  readonly steps: readonly OnboardingStep[];
  readonly skip: string;
  readonly next: string;
  readonly back: string;
  readonly start: string;
  readonly stepOf: (current: number, total: number) => string;
}

export const onboardingMessages = defineMessages<OnboardingMessages>(
  {
    steps: [
      {
        title: 'Bienvenue dans Carnet Digital 👋',
        text: 'Recevez et suivez les commandes de vos clients Messenger, votre stock et vos ventes, au même endroit.',
      },
      {
        title: '1. Ajoutez vos produits 📦',
        text: 'Onglet « Produits » : nom, prix et quantité en stock. Le bot ne propose à vos clients que ce qui est en stock.',
      },
      {
        title: '2. Reliez votre Page Facebook 🔗',
        text: 'Réglages › Commandes Facebook Messenger : saisissez le code qui vous a été remis, puis « Connecter ». Réglez aussi vos frais de livraison à Antananarivo.',
      },
      {
        title: '3. Le bot prend les commandes 🛒',
        text: 'Il répond à vos clients, demande leur téléphone et leur adresse, annonce les frais de livraison. La commande arrive ici avec une notification.',
      },
      {
        title: '4. Suivez et livrez 🚚',
        text: 'Dans la commande : appelez le client, écrivez-lui sur Messenger, puis passez-la « Confirmée », « En préparation » et « Livrée ». Le client est prévenu.',
      },
    ],
    skip: 'Passer',
    next: 'Suivant',
    back: 'Retour',
    start: 'Commencer',
    stepOf: (current, total) => `${current} / ${total}`,
  },
  {
    mg: {
      steps: [
        {
          title: 'Tongasoa amin’ny Carnet Digital 👋',
          text: 'Raiso sy araho eto ny kaomandin’ny mpanjifanao avy amin’ny Messenger, ny tahiry ary ny varotrao.',
        },
        {
          title: '1. Ampidiro ny entanao 📦',
          text: 'Ao amin’ny « Produits »: anarana, vidiny ary isa misy. Izay misy tahiry ihany no atolotry ny bot ny mpanjifanao.',
        },
        {
          title: '2. Ampifandraiso ny Page Facebook-nao 🔗',
          text: 'Réglages › Commandes Facebook Messenger: ampidiro ny code nomena anao, dia tsindrio « Connecter ». Apetraho koa ny saran’ny fanaterana ao Antananarivo.',
        },
        {
          title: '3. Ny bot no mandray ny kaomandy 🛒',
          text: 'Mamaly ny mpanjifanao izy, mangataka ny laharana finday sy ny adiresy, manambara ny saran’ny fanaterana. Tonga eto ny kaomandy miaraka amin’ny fampandrenesana.',
        },
        {
          title: '4. Araho sy atero 🚚',
          text: 'Ao amin’ny kaomandy: antsoy ny mpanjifa, soraty hafatra any amin’ny Messenger-ny, dia ovay ho « Voamafy », « Eo am-panomanana », « Tonga ». Ampahafantarina ny mpanjifa.',
        },
      ],
      skip: 'Dingano',
      next: 'Manaraka',
      back: 'Miverina',
      start: 'Hanomboka',
      stepOf: (current, total) => `${current} / ${total}`,
    },
    en: {
      steps: [
        {
          title: 'Welcome to Carnet Digital 👋',
          text: 'Receive and track your Messenger customers’ orders, your stock and your sales, all in one place.',
        },
        {
          title: '1. Add your products 📦',
          text: '“Products” tab: name, price and quantity in stock. The bot only offers your customers what is in stock.',
        },
        {
          title: '2. Link your Facebook Page 🔗',
          text: 'Settings › Facebook Messenger orders: enter the code you were given, then “Connect”. Also set your delivery fee in Antananarivo.',
        },
        {
          title: '3. The bot takes orders 🛒',
          text: 'It replies to your customers, asks for their phone and address, announces the delivery fee. The order arrives here with a notification.',
        },
        {
          title: '4. Track and deliver 🚚',
          text: 'In the order: call the customer, write to them on Messenger, then mark it “Confirmed”, “Preparing” and “Delivered”. The customer is notified.',
        },
      ],
      skip: 'Skip',
      next: 'Next',
      back: 'Back',
      start: 'Get started',
      stepOf: (current, total) => `${current} / ${total}`,
    },
  },
);
