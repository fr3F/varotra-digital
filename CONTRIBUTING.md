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

## Secrets

Ne jamais committer : `backend/.cloudflare-secrets.json`, `backend/.dev.vars`, `backend/.env`, jetons Meta, code d'appairage.
Ils sont ignorés par `.gitignore`. En cas de fuite : régénérer le secret chez Meta / Cloudflare immédiatement.

## Versions et releases

[SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.

1. Sur `develop` : mettre à jour `version` dans `package.json` et `app.json`, compléter `CHANGELOG.md`.
2. PR `develop` → `main`, puis tag : `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
3. Créer la release GitHub depuis le tag (notes = section du CHANGELOG) et y joindre l'APK EAS.
