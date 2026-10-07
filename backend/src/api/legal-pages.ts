/**
 * Pages publiques exigées par Meta pour la validation de l'application (App Review) :
 * politique de confidentialité et instructions de suppression des données.
 * Texte générique à relire et adapter par le vendeur (nom, contact).
 */

export interface LegalInfo {
  readonly businessName: string;
  readonly contactEmail: string | null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function contactLine(info: LegalInfo): string {
  return info.contactEmail === null
    ? 'en nous écrivant directement sur notre Page Facebook (Messenger)'
    : `par e-mail à <a href="mailto:${escapeHtml(info.contactEmail)}">${escapeHtml(info.contactEmail)}</a> ou sur notre Page Facebook (Messenger)`;
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px 16px; line-height: 1.6; color: #1f2933; }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.15rem; margin-top: 2rem; }
  a { color: #0f766e; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function privacyPolicyHtml(info: LegalInfo): string {
  const name = escapeHtml(info.businessName);
  return layout(
    `Politique de confidentialité — ${info.businessName}`,
    `<h1>Politique de confidentialité</h1>
<p>Cette politique explique comment <strong>${name}</strong> traite les informations reçues lorsque vous lui écrivez
sur sa Page Facebook via Messenger.</p>

<h2>Données collectées</h2>
<ul>
  <li>Votre identifiant Messenger propre à notre Page et, si Facebook le permet, vos nom et prénom ;</li>
  <li>le contenu des messages que vous nous envoyez (produits et quantités commandés) ;</li>
  <li>l’historique de vos commandes et des réponses que nous vous envoyons.</li>
</ul>

<h2>Utilisation</h2>
<p>Ces données servent uniquement à enregistrer et suivre vos commandes, vérifier la disponibilité des produits
et vous informer de l’état de votre commande. Elles ne sont ni vendues, ni utilisées à des fins publicitaires,
ni partagées avec des tiers, en dehors de Meta Platforms pour l’acheminement des messages Messenger.</p>

<h2>Conservation et sécurité</h2>
<p>Les données sont conservées sur notre serveur et dans l’application de gestion du vendeur, le temps nécessaire
au suivi des commandes et à la tenue de nos comptes. L’accès est protégé (connexion chiffrée HTTPS, appareils
autorisés uniquement).</p>

<h2>Vos droits</h2>
<p>Vous pouvez demander l’accès à vos données, leur correction ou leur suppression ${contactLine(info)}.
Voir aussi : <a href="/data-deletion">suppression de vos données</a>.</p>`,
  );
}

export function dataDeletionHtml(info: LegalInfo): string {
  const name = escapeHtml(info.businessName);
  return layout(
    `Suppression des données — ${info.businessName}`,
    `<h1>Suppression de vos données</h1>
<p>Pour demander la suppression des données que <strong>${name}</strong> détient à votre sujet
(identifiant Messenger, nom, messages et historique de commandes) :</p>
<ol>
  <li>contactez-nous ${contactLine(info)} ;</li>
  <li>indiquez « Suppression de mes données » ;</li>
  <li>nous supprimons vos données sous 30 jours et vous le confirmons par message.</li>
</ol>
<p>Les informations que la loi nous impose de conserver (pièces comptables liées à une vente) peuvent être
conservées pendant la durée légale, sans être utilisées à d’autres fins.</p>
<p><a href="/privacy">Politique de confidentialité</a></p>`,
  );
}
