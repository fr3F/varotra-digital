# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté
- Frais de livraison « à convenir » (hors Antananarivo) : champ sur la fiche commande ; une fois saisis, ils sont enregistrés et envoyés au client sur Messenger avec le total à payer, dans sa langue (POST /v1/orders/:id/delivery-fee, file d'envoi hors ligne, règle des 24 h).

### Modifié
- Barre de navigation sur tous les écrans (fiches produit, vente, client, stock, dépenses, notifications…), pas seulement sur les onglets : composant BottomNav dans le layout racine, onglet de la rubrique allumé, pastille des commandes nouvelles ; masquée pendant la saisie et pendant le guide du premier lancement.
- Fiche commande épurée : statut et badges en haut, une carte client (nom vers la fiche, téléphone en grand avec « Appeler », adresse), produits avec frais de livraison et total, puis les actions ; Messenger et historique dans des tiroirs fermés. La barre d'onglets reste visible sur la fiche et la modification d'une commande (pile dans l'onglet Commandes).
- Réglages en tiroirs (Langue, Messenger, Notifications, Zone de danger) : fermés par défaut, l'en-tête montre un résumé (langue, Page reliée, notifications bloquées).
- Réglages et pages de connexion Facebook épurés : seulement l'essentiel (plus de paragraphes d'explication, d'adresse du serveur ni d'état des notifications push ; la carte des notifications n'apparaît que si elles sont bloquées).

### Corrigé
- « Hiverina amin'ny app » à la fin de la connexion Facebook rouvre l'application aussi dans Expo Go : l'application envoie son adresse de retour (carnetdigital://messenger dans l'APK, exp://… dans Expo Go), le serveur n'accepte que ces deux schémas (migration D1 0008). Les anciennes versions de l'application gardent carnetdigital://messenger.
- « Se connecter avec Facebook » : on peut choisir une autre Page ou un autre compte Facebook. La page de choix affiche le compte connecté et un bouton « Page hafa na kaonty Facebook hafa », qui retire l'autorisation donnée à l'application puis relance la connexion depuis le début ; avant, Facebook ne renvoyait que la Page cochée la première fois. Autorisation business_management demandée en plus, pour voir aussi les Pages gérées depuis Meta Business Suite.
- Une boutique porte le nom de la Page Facebook choisie par le vendeur (plus de « Boutique principale ») ; la boutique d'origine reçoit un vrai code d'activation KD-XXXX-XXXX visible dans /admin (migration D1 0007).
- « Se connecter avec Facebook » : Facebook propose à nouveau le choix des Pages à chaque connexion (auth_type=reauthorize) ; avant, il reprenait en silence la Page choisie la première fois.
- Bot Messenger lisible sur Facebook Lite (téléphone), qui n'affiche aucune bulle à boutons : le texte part seul avec les choix numérotés (« 1. Kiraro… ✍️ Valio amin'ny laharana »), le client peut répondre « 1 », « 2 »… ; les boutons suivent dans une bulle « 👇 » pour Messenger (META_BUTTON_STYLE=text_first, par défaut ; template et quick_replies restent possibles).

### Ajouté
- Plusieurs boutiques sur le même serveur, pour vendre l'application : même APK pour tous, une Page Facebook par boutique. Page /admin (code d'activation KD-XXXX-XXXX, abonnement de 1 à 12 mois, +1/+3 mois, suspendre) ; dans l'application, saisie du code d'activation puis « Se connecter avec Facebook » (choix de la Page dans le navigateur, retour automatique) ; catalogue, conversations, commandes et frais séparés par boutique ; abonnement fini : le bot se tait et l'application l'indique. Les données existantes deviennent la boutique « default » (migration D1 0006).
- Écrire au client depuis l'application : sur une commande Messenger, champ « ✉️ Écrire au client » et bouton « Envoyer » ; le message part sur son Messenger (via le serveur, POST /v1/orders/:id/message), même hors ligne (file d'envoi), et apparaît dans l'historique des réponses avec son résultat (envoyé, ou plus de 24 h depuis son dernier message).
- Livraison sur Messenger : après « Valider », le bot demande le téléphone puis l'adresse avant d'enregistrer la commande. Dans Antananarivo (ville et quartiers reconnus dans l'adresse), il annonce des frais fixes ajoutés au total (3 000 Ar par défaut, modifiables dans Réglages › Messenger) ; ailleurs ou lieu inconnu, le responsable appelle le client pour les frais (commande « à vérifier »). Dans l'application, la commande affiche une carte « 🚚 Livraison » (téléphone en gros avec bouton d'appel, adresse, frais et total avec livraison, ou « frais à convenir » en orange) et la liste des commandes montre le téléphone et l'adresse ; la fiche client est remplie.
- Guide de démarrage au premier lancement après l'installation (malgache, français, anglais) : bienvenue, produits, liaison de la Page Facebook, prise de commande par le bot, suivi et livraison ; « Passer » à tout moment ; il ne s'affiche plus ensuite.
- Centre de notifications : cloche 🔔 dans l'en-tête de chaque écran avec pastille des non lues ; historique des événements (nouvelles commandes, livraisons, stock bas ou en rupture, erreurs de synchronisation), un appui ouvre la commande ou le produit ; « Tout marquer comme lu », « Tout effacer ».
- Accueil : graphique du chiffre d'affaires filtrable — découpage Jours / Semaines / Mois / Années et nombre de périodes saisi librement (champ avec − / +, jusqu'à 90 jours, 52 semaines, 24 mois, 10 ans).
- Application en malgache, français et anglais : bouton langue (drapeaux 🇲🇬 🇫🇷 🇬🇧) en haut de chaque écran et Réglages › Langue ; langue du téléphone par défaut, choix enregistré.

### Modifié
- Application de suivi : plus de création de ventes, de clients ni de dépenses (en plus des commandes). Les ventes viennent des commandes livrées, les clients de Messenger ; fiches client et dépenses existantes restent modifiables. « + Vente » de l'accueil devient « Ventes ».
- Interface plus claire : texte plus grand (corps 16) et mieux contrasté, fond blanc, listes en cartes avec flèche, champs de formulaire gris clair avec bordure rouge à la saisie, recherche avec loupe et bouton effacer, statuts de commande avec icône, écrans vides illustrés, accès rapides à icônes sur l'accueil.
- Écran de démarrage : logo « Carnet Digital » blanc sur fond rouge (écran natif dans l'APK et écran d'ouverture dans l'application, visible aussi dans Expo Go).
- Nouvelle interface « Bite » : rouge bordeaux, en-têtes blancs, boutons et puces en pilule, cartes à ombre douce, barre d'onglets rouge (Accueil, Commandes avec pastille des nouvelles, Produits, Ventes, Réglages), produits en grille de cartes avec photo.
- Commandes : l'application ne crée plus de commandes, elle en assure le suivi. Les commandes arrivent par Messenger ; on peut les corriger, les valider, les livrer ou les annuler. Boutons « + Nouvelle commande » retirés (liste, tableau de bord, fiche client).

### Ajouté
- Réglages › Zone de danger : « Supprimer toutes les données » (produits, stock, commandes, ventes, dépenses, clients, photos), avec résumé et double confirmation ; réglages et liaison Messenger conservés.
- Bot intelligent : fautes de frappe tolérées (« kirarro », « tshirt »), réponses aux questions de prix, de disponibilité et de description (« ohatrinona ny kiraro ? », « vous avez des casquettes ? »), client fidèle reconnu (« Faly mahita anao indray », bouton et phrase « toy ny teo » pour recommander), suggestions selon ses achats, réponse polie aux remerciements.
- Bot vendeur : produits les plus commandés mis en avant (⭐, ventes réelles des 30 derniers jours), stock faible signalé (🔥 vrai chiffre), description du produit (saisie dans l'application), produits complémentaires proposés dans le panier, invitation à valider, accueil plus engageant, relance unique d'un panier abandonné après 1 h (dans les 24 h Messenger).
- Bot Messenger multilingue : comprend le malgache, le français et l'anglais (langue détectée sur chaque message, réponses et boutons dans la langue du client), nombres en lettres (« roa ambin'ny folo », « vingt-cinq », « twelve », « une douzaine »), « eny / oui / yes » pour valider. Dans une autre langue, chiffres et noms de produits restent compris.
- Notifications push « Nouvelle commande » envoyées par le serveur (Expo Push), même application fermée ; un appui importe et ouvre la commande. Nécessite l'APK (projet EAS + FCM).

### Modifié
- Bot Messenger : le stock est vérifié avant validation. Au-delà du stock, le bouton « Valider » est remplacé par « Ajuster au stock » (produits épuisés retirés) ; aucune commande n'est créée au-delà du stock.
- Messenger : les nouvelles commandes arrivent dans l'application en 15 s au plus (au lieu de 60 s) tant qu'elle est ouverte.

## [0.1.0] - 2026-10-05

Première version.

### Application
- Produits : image, catégorie, recherche, référence, seuils d'alerte.
- Stock : entrées, sorties, ajustements, historique des mouvements, réservation par les commandes.
- Commandes : statuts Nouvelle / Préparation / Confirmée / Livrée / Annulée ; validation impossible si le stock
  est insuffisant (ajuster au stock disponible, ajouter du stock ou annuler).
- Clients et historique d'achats ; ventes avec calcul du bénéfice ; dépenses par catégorie.
- Tableau de bord (indicateurs et graphiques) ; notifications locales (désactivées dans Expo Go).
- Messenger : appairage avec le serveur, import des commandes, réponse automatique
  (« Votre commande est confirmée. » / « Produit indisponible actuellement. »), historique des réponses.

### Serveur (`backend/`)
- Webhook Messenger signé (HMAC), conversation de commande en français et malgache, API appareil.
- Déploiement Cloudflare Workers + D1 (`npm run cloudflare:deploy`).
