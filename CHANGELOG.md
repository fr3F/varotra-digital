# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

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
