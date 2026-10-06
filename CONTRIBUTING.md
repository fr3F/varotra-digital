# Contribuer

## Branches

| Branche | Rôle | Qui y pousse |
|---|---|---|
| `main` | Version publiée (releases taguées `vX.Y.Z`) | Uniquement par Pull Request depuis `develop` ou `hotfix/*` |
| `develop` | Intégration du travail en cours | Uniquement par Pull Request |
| `feature/<sujet>` | Nouvelle fonctionnalité (ex. `feature/export-ventes`) | Son auteur, partie de `develop` |
| `fix/<sujet>` | Correction non urgente | Partie de `develop` |
| `hotfix/<sujet>` | Correction urgente de la version publiée | Partie de `main`, fusionnée dans `main` **et** `develop` |

```bash
git switch develop && git pull
git switch -c feature/mon-sujet
# ... travail, commits ...
git push -u origin feature/mon-sujet   # puis ouvrir une Pull Request vers develop
```

## Commits

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) :
`feat(orders): …`, `fix(stock): …`, `refactor:`, `docs:`, `test:`, `chore:`.
Portées usuelles : `products`, `stock`, `orders`, `clients`, `sales`, `expenses`, `dashboard`, `messenger`, `backend`.

## Avant d'ouvrir une Pull Request

```bash
npm run lint && npm run typecheck                         # application
cd backend && npm test && npm run typecheck               # serveur
```

La CI GitHub relance ces vérifications ; une PR ne se fusionne que si elle est verte et relue par une autre personne.

## Règles du code

- TypeScript strict, jamais de `any` ; montants en entiers (Ariary).
- Écrans dans `src/app/` uniquement ; la logique dans `services/`, l'accès SQLite dans `database/repositories/`.
- Nouvelle table ou colonne : **nouvelle migration** (`src/database/migrations/00X_*.ts` ou `backend/migrations/000X_*.sql`), ne jamais modifier une migration déjà publiée.
- Paquets Expo : `npx expo install <paquet>` (versions compatibles SDK).
- npm **11.6.2** (`npm install -g npm@11.6.2`) : une autre version réécrit `package-lock.json` différemment et casse `npm ci` dans la CI.

## Secrets

Ne jamais committer : `backend/.cloudflare-secrets.json`, `backend/.dev.vars`, `backend/.env`, jetons Meta, code d'appairage.
Ils sont ignorés par `.gitignore`. En cas de fuite : régénérer le secret chez Meta / Cloudflare immédiatement.

## Pipelines CI/CD (GitHub Actions)

| Pipeline | Déclencheur | Ce qu'il fait |
|---|---|---|
| `ci.yml` | Chaque Pull Request, push sur `main` / `develop` | Lint + typecheck de l'application ; tests + typecheck du serveur |
| `deploy-backend.yml` | Fusion dans `main` touchant `backend/` (ou lancement manuel) | CI, puis migrations D1 et déploiement Cloudflare, puis vérification `/health` |
| `quality.yml` | Chaque Pull Request, push sur `main` / `develop` | Titre de PR (Conventional Commits), lint sans avertissement, couverture serveur (≥ 90 % lignes, ≥ 75 % branches), `expo-doctor`, `npm audit`, recherche de secrets (gitleaks) |
| `codeql.yml` | PR, push, chaque lundi | Analyse de sécurité CodeQL (Security › Code scanning) |
| `release.yml` | Push d'un tag `vX.Y.Z` | CI, contrôle des versions, release GitHub (notes du CHANGELOG), APK EAS joint |

Dependabot (`.github/dependabot.yml`) propose chaque semaine les mises à jour des dépendances (hors paquets Expo / React Native, qui suivent le SDK) vers `develop`.

Secrets du dépôt (Settings › Secrets and variables › Actions) : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `EXPO_TOKEN`.
L'environnement GitHub `production` peut exiger une approbation avant chaque déploiement.

## Versions et releases

[SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.

1. Sur `develop` : mettre à jour `version` dans `package.json` et `app.json`, compléter `CHANGELOG.md`.
2. PR `develop` → `main` (le serveur est déployé automatiquement à la fusion).
3. Tag sur `main` : `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z` — la release GitHub et l'APK sont créés par `release.yml`.
