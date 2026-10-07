# Meta App Review — Carnet Digital

Objectif : que **n'importe quel vendeur** ayant une Page Facebook ordinaire puisse acheter l'APK, relier sa Page
et recevoir les commandes de ses clients, sans compte développeur Meta. Tant que l'App Review n'est pas validée
et l'application passée en **Live**, seuls les comptes ayant un rôle sur l'application Meta (administrateur,
développeur, testeur) peuvent se connecter, et le bot ne répond qu'à eux.

Les blocs en anglais sont à **copier-coller** dans les formulaires Meta (les examinateurs lisent l'anglais).

## 1. Avant de soumettre (liste de contrôle)

| Étape | Où | État |
|---|---|---|
| Vérification de l'entreprise (Business Verification) | Meta Business Suite › Paramètres › Centre de sécurité | à faire |
| E-mail de contact dans la politique de confidentialité | `CONTACT_EMAIL` dans `backend/wrangler.jsonc`, puis `npm run deploy` | **vide** |
| Politique de confidentialité à jour (téléphone et adresse de livraison, données des vendeurs) | `backend/src/api/legal-pages.ts` | fait |
| Paramètres de base de l'application (§2) | developers.facebook.com › votre app › Paramètres › Général | à vérifier |
| APK de test téléchargeable (lien EAS ou release GitHub) | `eas build --profile preview` | à faire |
| Boutique de test + code d'activation pour les examinateurs | `https://carnet-digital-backend.fb-page-bot.workers.dev/admin` | à faire |
| Vidéos (une par autorisation, ou une vidéo couvrant tout) | §4 | à faire |
| Langue de l'application sur **English** pendant les vidéos | bouton 🇬🇧 en haut de l'écran | — |

## 2. Paramètres de l'application Meta

**Paramètres › Général**

| Champ | Valeur |
|---|---|
| Privacy Policy URL | `https://carnet-digital-backend.fb-page-bot.workers.dev/privacy` |
| User data deletion | Instructions URL : `https://carnet-digital-backend.fb-page-bot.workers.dev/data-deletion` |
| Category | Business and Pages |
| App icon | `assets/icon.png` (1024 × 1024) |
| Contact email | votre e-mail professionnel |

**Facebook Login for Business › Paramètres**

- Valid OAuth Redirect URI : `https://carnet-digital-backend.fb-page-bot.workers.dev/connect/facebook/callback`

**Messenger › Paramètres de l'API › Webhooks**

- Callback URL : `https://carnet-digital-backend.fb-page-bot.workers.dev/webhooks/messenger`
- Champs : `messages`, `messaging_postbacks`

## 3. Autorisations demandées (accès avancé)

Le serveur demande exactement : `pages_show_list`, `pages_messaging`, `pages_manage_metadata`,
`business_management` (`backend/src/messenger/facebook-oauth.ts`, `FACEBOOK_SCOPES`).

### App description (champ « Tell us how your app works »)

```text
Carnet Digital is an Android app for small shops in Madagascar that sell through their Facebook Page.
A shop owner buys the app, enters the activation code we give them, and taps "Log in with Facebook" to
connect their own Page. Our server then receives the messages customers send to that Page and answers
them with an order assistant: it shows the shop's products with prices and stock, asks for the quantity,
the delivery phone number and address, and sends an order summary. The order appears in the shop owner's
app, where they confirm, deliver or cancel it; the customer is informed by a Messenger reply. The shop
owner can also write to the customer and send the delivery fee. All messages are sent inside the 24-hour
standard messaging window; we do not use message tags and we never send promotional messages.
```

### `pages_show_list`

```text
After the shop owner logs in with Facebook, we call /me/accounts to list the Pages they manage. The list
is shown on a web page so they can choose which Page to connect to their shop. We store only the ID and
name of the Page they choose. Without this permission the shop owner cannot select their Page.
```

### `pages_manage_metadata`

```text
When the shop owner chooses a Page, our server calls POST /{page-id}/subscribed_apps with the fields
"messages" and "messaging_postbacks", so that messages sent by customers to that Page reach our webhook.
We do not change any other Page setting.
```

### `pages_messaging`

```text
This is the core of the app. When a customer writes to the shop's Page, our webhook receives the message
and our server replies through the Send API (POST /me/messages) with the product list, quick reply
buttons, questions about quantity, phone number and delivery address, and an order summary. When the shop
owner confirms, delivers or cancels the order in the app, or writes a message to the customer, the reply is
sent through the same API. We also read the customer's first and last name (GET /{psid}) to show who
placed the order. Every message answers a message from the customer and is sent within the 24-hour
standard messaging window. No message tags, no marketing messages.
```

### `business_management`

```text
Many shop owners manage their Page from Meta Business Suite (business portfolio). Without this permission,
/me/accounts does not return those Pages and the shop owner sees an empty list. We use it only to list the
Pages the shop owner manages through their business portfolio so they can pick one. We do not read, create
or modify any other business asset (ad accounts, catalogs, users, etc.).
```

## 4. Vidéos (screencast)

Une seule vidéo peut couvrir toutes les autorisations si chaque étape est visible. Téléphone Android,
langue de l'application sur **English**, durée 2–4 min, sans montage trompeur.

1. **Installation et activation** — ouvrir l'APK ; Settings › Facebook Messenger orders ; saisir l'adresse du
   serveur (pré-remplie) et le code d'activation ; « Connect ».
2. **Connexion Facebook** (`pages_show_list`, `business_management`) — « Log in with Facebook » ; montrer la
   fenêtre Facebook avec la liste des autorisations ; accepter ; la page « Safidio ny Page Facebook » liste les
   Pages ; toucher la Page de test.
3. **Abonnement de la Page** (`pages_manage_metadata`) — page « Vita ✅ » puis retour automatique dans
   l'application : Settings affiche « Facebook Page: <nom> ».
4. **Commande d'un client** (`pages_messaging`) — sur un **autre** compte (client test), ouvrir Messenger,
   écrire à la Page « Hello » ; le bot répond avec la liste numérotée des produits ; choisir un produit,
   une quantité, « ✅ Confirm » ; donner un numéro et une adresse ; le bot envoie le récapitulatif.
5. **Côté vendeur** — la commande apparaît dans Orders ; ouvrir la fiche ; « Confirm (reserve stock) » ; montrer, côté client,
   la réponse « Your order is confirmed. » ; écrire un message au client depuis la fiche (tiroir Messenger)
   et montrer qu'il arrive.
6. **Changer de Page** (facultatif) — « Change Facebook Page » › « Page hafa na kaonty Facebook hafa ».

## 5. Instructions pour les examinateurs (« Test instructions »)

Avant d'envoyer : créer dans `/admin` une boutique « Meta Review » (12 mois) et remplacer `KD-XXXX-XXXX`
ci-dessous par son code ; mettre le lien de l'APK.

```text
1. Install the Android app from: <APK LINK>
2. Open the app. Tap the flag at the top to switch the language to English.
3. Go to the Settings tab > "Facebook Messenger orders".
   Server address (already filled): https://carnet-digital-backend.fb-page-bot.workers.dev
   Activation code: KD-XXXX-XXXX
   Tap "Connect".
4. Tap "Log in with Facebook", log in with a Facebook account that is admin of a test Page, accept the
   permissions, then tap the Page to connect. You are sent back to the app.
5. From another Facebook account, send "Hello" to that Page in Messenger. The assistant replies with the
   product list (add products first in the Products tab if the catalog is empty). Follow the questions
   (product, quantity, "Confirm", phone number, address).
6. In the app, open the Orders tab: the order is there. Open it and tap "Confirm (reserve stock)": the customer receives a
   confirmation in Messenger. You can also write to the customer from the "Messenger" section of the order.
```

## 6. Questionnaire sur les données (Data Use / Data Handling)

```text
Data we receive: Page ID, Page name and Page access token of the Page chosen by the shop owner; for
customers, the Page-scoped ID, first and last name, the text of their messages, and the phone number and
delivery address they give to place an order.
Purpose: only to take and follow customer orders for the shop that owns the Page.
Storage: Cloudflare (D1 database, HTTPS only) and the shop owner's phone. Page tokens are never sent to the
phone. Data is not sold, not used for advertising and not shared with third parties.
Deletion: on request through the data deletion page (within 30 days); disconnecting a Page stops all
processing for it.
```

La politique de confidentialité (`/privacy`) décrit les mêmes données (clients et boutiques). **Reste à faire** :
renseigner `CONTACT_EMAIL`, l'e-mail affiché sur `/privacy` et `/data-deletion`.

## 7. Après validation

1. Passer l'application en **Live** (interrupteur « App Mode » en haut du tableau de bord).
2. Vérifier avec un compte Facebook sans rôle : connexion, choix de la Page, réponse du bot à un client.
3. Retirer les testeurs devenus inutiles.
