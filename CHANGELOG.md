# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Corrigé
- Bot Messenger lisible sur Facebook Lite (téléphone), qui n'affiche aucune bulle à boutons : le texte part seul avec les choix numérotés (« 1. Kiraro… ✍️ Valio amin'ny laharana »), le client peut répondre « 1 », « 2 »… ; les boutons suivent dans une bulle « 👇 » pour Messenger (META_BUTTON_STYLE=text_first, par défaut ; template et quick_replies restent possibles).

### Ajouté
- Livraison sur Messenger : après « Valider », le bot demande le téléphone puis l'adresse avant d'enregistrer la commande. Dans Antananarivo (ville et quartiers reconnus dans l'adresse), il annonce des frais fixes ajoutés au total (3 000 Ar par défaut, modifiables dans Réglages › Messenger) ; ailleurs ou lieu inconnu, le responsable appelle le client pour les frais (commande « à vérifier »). Le téléphone et l'adresse remplissent la fiche client et la note de la commande.
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
