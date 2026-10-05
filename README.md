# Varotra Digital — Carnet Digital

Carnet de vente hors ligne pour les vendeurs : produits, stock, commandes, ventes, dépenses, clients,
tableau de bord, et réception des commandes **Facebook Messenger** avec réponse automatique.

| Dossier | Contenu |
|---|---|
| `src/` | Application mobile Expo (SDK 57, expo-router, expo-sqlite, TypeScript strict) |
| `backend/` | Serveur Messenger (Hono) : Cloudflare Workers + D1 en production, Node 24 en local — voir [`backend/README.md`](backend/README.md) |

## Démarrer (application)

```bash
npm install
npx expo start          # puis Expo Go : exp://<ip-du-pc>:8081
npm run lint
npm run typecheck
```

> Dans Expo Go (Android), les notifications sont désactivées : elles fonctionnent dans un APK ou un development build.

## Structure de `src/`

- `app/` — routes expo-router uniquement (un fichier = un écran)
- `features/` — écrans et composants par domaine (products, stock, orders, clients, sales, expenses, dashboard, settings, messenger)
- `services/` — règles métier (stock, commandes, ventes, synchronisation Messenger, notifications)
- `database/` — SQLite : migrations (`PRAGMA user_version`) et repositories
- `models/` — types du domaine · `shared/` — composants et hooks réutilisables · `core/` — thème, erreurs, état, providers

## Builds

```bash
npx eas-cli@latest build --profile preview --platform android      # APK de test
npx eas-cli@latest build --profile production --platform android   # AAB pour le Play Store
```

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) (branches, commits, revues, versions) et [CHANGELOG.md](CHANGELOG.md).
