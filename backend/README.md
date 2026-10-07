# Carnet Digital — backend Messenger

Serveur intermédiaire entre une **Page Facebook** et l'application **Carnet Digital**.
L'application ne contacte jamais Facebook : le jeton de la Page reste sur ce serveur.

```
Client Facebook ──► Meta Messenger Platform ──► webhook HTTPS ──► ce backend
                                                                   │  • vérifie la signature Meta
                                                                   │  • conversation (boutons + texte libre)
                                                                   │  • crée la commande, répond au client
                                                                   ▼
                                     Application ◄── API /v1 (jeton d'appareil) : catalogue, commandes, statuts
```

## Ce que fait le serveur

| Étape | Détail |
|---|---|
| Réception | `POST /webhooks/messenger` : signature `X-Hub-Signature-256` vérifiée sur le corps brut, réponse 200 immédiate (Meta exige < 5 s), traitement en file, un événement n'est traité qu'une fois. |
| Conversation guidée | Bouton « Démarrer » ou « menu » → produits disponibles (réponses rapides) → quantité → panier → ✅ Valider. |
| Texte libre | « mila huile tiko 2 sy savon iray », « 2 huile et 1 savon », « HT1 x3 »… Quantités en chiffres, en français ou en malgache ; noms approximatifs reconnus à partir du catalogue. Ambiguïté → le client choisit dans le menu. |
| Message incompris | Le client peut l'« envoyer tel quel au vendeur » : commande **à vérifier**. |
| Stock | Le backend connaît la quantité **disponible** envoyée par l'application (catalogue) : il ne propose que les produits en stock et signale un dépassement. La vérification qui fait foi a lieu dans l'application à l'import. |
| Récupération | L'application relève les commandes (`GET /v1/orders/pending`), les enregistre, puis les acquitte (`POST /v1/orders/ack`). Tant qu'elles ne sont pas acquittées, elles restent disponibles : rien n'est perdu si le téléphone est hors ligne. |
| Réponse automatique | Après import, l'application vérifie son stock et demande au backend (`POST /v1/orders/:id/notify`) d'envoyer **« Votre commande est confirmée. »** (stock disponible, commande validée) ou **« Produit indisponible actuellement. »** (stock insuffisant, avec le détail). Messages incompris : pas de réponse automatique. |
| Suivi client | Quand le vendeur passe la commande en préparation, la livre ou l'annule, le client reçoit le message correspondant (même route). |
| Statut | Le client écrit « statut », « ma commande », « aiza ny kaomandiko ? » : le bot répond avec l'état de sa dernière commande. |
| Historique | Chaque message envoyé est journalisé avec son type et son résultat (`GET /v1/orders/:id/replies`), y compris les messages non envoyés hors de la fenêtre de 24 h. |

## Démarrer en local

Prérequis : **Node.js 24** (exécute TypeScript directement, SQLite intégré). Serveur HTTP : Hono.

```bash
cd backend
npm install
cp .env.example .env        # puis renseignez les valeurs (voir ci-dessous)
npm run dev                 # http://localhost:3000
npm test                    # 30 tests (lecture des messages, conversation, API, signature, fenêtre 24 h)
```

Sans `META_PAGE_ACCESS_TOKEN`, le serveur est en **mode simulation** : rien n'est envoyé à Meta, les réponses
sont journalisées. Avec `DEV_TOOLS=true`, le simulateur affiche ce que le client recevrait :

```bash
npm run simulate -- --postback GET_STARTED
npm run simulate -- "Salama, mila huile tiko 2 sy savon iray"
npm run simulate -- --reply CHECKOUT
npm run simulate -- --psid 555 "Vous livrez à Toamasina ?"
```

Dans l'application : **Réglages › Commandes Facebook Messenger** → adresse du serveur + `APP_PAIRING_CODE`.
Sur un téléphone, utilisez l'adresse réseau de l'ordinateur (ex. `http://192.168.1.20:3000`) ou un tunnel HTTPS.

## Héberger sur Cloudflare (gratuit, sans carte bancaire)

Production : **Cloudflare Workers + D1** (offre gratuite : 100 000 requêtes/jour, 5 Go de base, pas de mise en veille).
Le même code tourne sur Node (`src/server.ts`, développement) et sur Workers (`src/worker.ts`).

```bash
cd backend
npx wrangler login            # une seule fois (ouvre le navigateur)
npm run cloudflare:deploy     # crée la base D1, applique les migrations, déploie, envoie les secrets
```

La commande affiche l'adresse `https://carnet-digital-backend.<sous-domaine>.workers.dev`, le code d'appairage et
les valeurs à saisir chez Meta. Les secrets générés sont gardés dans `.cloudflare-secrets.json` (jamais versionné) :
pour ajouter l'App Secret et le Page Access Token de Meta, les écrire dans ce fichier puis relancer la commande.
Nom et e-mail des pages `/privacy` et `/data-deletion` : `BUSINESS_NAME` et `CONTACT_EMAIL` dans `wrangler.jsonc`.

Tester le Worker localement (même moteur que Cloudflare, base D1 locale, secrets dans `.dev.vars`) :

```bash
npx wrangler d1 migrations apply carnet-backend --local
npm run worker:dev            # http://localhost:8787
```

## Brancher une vraie Page Facebook

1. **Déployer le serveur** sur Cloudflare (ci-dessus) : l'adresse `*.workers.dev` est déjà en HTTPS.
2. Sur [developers.facebook.com](https://developers.facebook.com) : créer une application de type *Business*,
   ajouter le produit **Messenger**, relier votre **Page**.
3. Copier le **secret de l'application** dans `META_APP_SECRET` et générer le **jeton d'accès de la Page**
   (`META_PAGE_ACCESS_TOKEN`).
4. Configurer le **webhook** : URL `https://votre-serveur/webhooks/messenger`, jeton de vérification =
   `META_VERIFY_TOKEN`, champs **messages** et **messaging_postbacks**.
5. Tester avec un compte ayant un rôle sur l'application (administrateur, testeur).
6. Pour les clients publics : **App Review** de l'autorisation `pages_messaging` (et, si demandé, vérification
   de l'entreprise). Une politique de confidentialité publiée est obligatoire.
7. Facultatif : bouton « Démarrer » de la Page avec la charge utile `GET_STARTED`.

## Limites à connaître

- **Fenêtre de 24 h** : la Page ne peut écrire au client que dans les 24 h suivant son dernier message.
  Depuis le 27/04/2026, Meta refuse les « message tags » `POST_PURCHASE_UPDATE`, `CONFIRMED_EVENT_UPDATE`
  et `ACCOUNT_UPDATE` ([journal Meta](https://developers.facebook.com/docs/messenger-platform/changelog/)) : hors
  fenêtre, le serveur n'envoie rien et l'application indique au vendeur de contacter le client lui-même.
  Les *utility templates* de Meta pourraient lever cette limite plus tard.
- **Nom du client** : lu via l'API de profil Meta si l'autorisation le permet, sinon « Client Messenger ».
- **Pièces jointes** (photos, vocaux) : non lues ; le client est invité à écrire.
- En local, `node:sqlite` est encore signalé « expérimental » par Node 24 (avertissement sans effet) ; en production, la base est D1.

## Plusieurs boutiques (vendre l'application)

Un seul serveur sert toutes les boutiques : la même APK pour tout le monde, une Page Facebook par boutique.

1. **Vous** ouvrez `https://…workers.dev/admin` (jeton `ADMIN_TOKEN`), créez la boutique et sa durée
   (1, 3, 6 ou 12 mois) : un **code d'activation** `KD-XXXX-XXXX` s'affiche ; remettez-le au client après paiement.
2. **Le client** installe l'APK, saisit le code dans Réglages › Messenger, puis touche
   « Se connecter avec Facebook » : il se connecte, choisit sa Page, revient dans l'application.
3. Le serveur garde le jeton de sa Page, abonne la Page au webhook et range chaque message dans
   la bonne boutique (catalogue, conversations, commandes, frais de livraison séparés).
4. Abonnement fini ou boutique suspendue (`/admin`) : le bot se tait et l'application affiche
   « Abonnement terminé » ; « +1 mois » la réactive.

La boutique `default` reprend les données d'avant (ancien code d'appairage `APP_PAIRING_CODE` et
`META_PAGE_ACCESS_TOKEN`) : elle adopte la première Page qui écrit au serveur.

### Réglages Meta (une fois)

- `META_APP_ID` (wrangler.jsonc › vars) : identifiant de l'application Meta.
- Produit **Facebook Login for Business** › URI de redirection OAuth valide :
  `https://…workers.dev/connect/facebook/callback`.
- Webhook Messenger de l'application (objet `page`, champs `messages`, `messaging_postbacks`) :
  `https://…workers.dev/webhooks/messenger` ; chaque Page reliée s'y abonne automatiquement.
- **App Review** : `pages_messaging`, `pages_show_list`, `pages_manage_metadata` en accès avancé,
  et vérification de l'entreprise. Sans elles, seuls les comptes ajoutés comme testeurs de
  l'application Meta peuvent se connecter.

## Sécurité

- Signature HMAC-SHA256 de chaque webhook, comparaison en temps constant ; un webhook non signé est refusé (401).
- L'application s'authentifie avec un jeton d'appareil (seul son hachage SHA-256 est stocké), obtenu une fois
  avec le code d'appairage ; 5 essais de code par 10 minutes et par adresse IP.
- `DEV_TOOLS` doit rester à `false` en production (les routes `/dev` exposent les messages envoyés).
- CORS limité aux origines de `CORS_ORIGINS` (version web de l'application).
