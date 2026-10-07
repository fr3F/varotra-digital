/**
 * Pages affichées dans le navigateur pendant « Se connecter avec Facebook » (ouvert par
 * l'application) : choix de la Page, succès, erreur. Le bouton final rouvre l'application.
 */
import type { FacebookPage } from '../messenger/facebook-oauth.ts';
import { escapeHtml } from './legal-pages.ts';

/** Adresse qui rouvre l'application (schéma déclaré dans app.json). */
export const APP_RETURN_URL = 'carnetdigital://messenger';

function layout(title: string, body: string, extraHead = ''): string {
  return `<!doctype html>
<html lang="mg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${extraHead}
<style>
  body { font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px 16px; line-height: 1.5; color: #1f2933; }
  h1 { font-size: 1.4rem; }
  .muted { color: #52606d; font-size: .95rem; }
  button, .button { display: block; width: 100%; box-sizing: border-box; margin: 12px 0; padding: 16px; border: 0; border-radius: 12px;
    background: #A3161D; color: #fff; font-size: 1.05rem; font-weight: 700; text-align: center; text-decoration: none; }
  .page { background: #fff; color: #1f2933; border: 2px solid #A3161D; }
  .error { color: #b42318; font-weight: 600; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Choix de la Page à relier à la boutique. */
export function choosePageHtml(shopName: string, state: string, pages: readonly FacebookPage[]): string {
  if (pages.length === 0) {
    return errorHtml(
      'Tsy nahitana Page Facebook tantanao. Ataovy azo antoka fa admin amin’ny Page ianao, ary nekenao ny alalana rehetra.',
    );
  }
  const buttons = pages
    .map(
      (page) => `<form method="post" action="/connect/facebook/page">
  <input type="hidden" name="state" value="${escapeHtml(state)}">
  <input type="hidden" name="pageId" value="${escapeHtml(page.id)}">
  <button class="page" type="submit">${escapeHtml(page.name)}</button>
</form>`,
    )
    .join('\n');
  return layout(
    'Safidio ny Page',
    `<h1>Safidio ny Page Facebook</h1>
<p class="muted">Fivarotana: <strong>${escapeHtml(shopName)}</strong>. Ny bot no hamaly ny mpanjifa mandefa hafatra amin’io Page io.</p>
${buttons}`,
  );
}

/** Page reliée : retour automatique dans l'application. */
export function connectedHtml(pageName: string): string {
  return layout(
    'Vita',
    `<h1>Vita ✅</h1>
<p>Mifandray amin’ny Page <strong>${escapeHtml(pageName)}</strong> izao ny fivarotanao.</p>
<a class="button" href="${APP_RETURN_URL}?connected=1">Hiverina amin’ny app</a>`,
    `<meta http-equiv="refresh" content="1;url=${APP_RETURN_URL}?connected=1">`,
  );
}

export function errorHtml(message: string): string {
  return layout(
    'Tsy vita',
    `<h1>Tsy vita ny fampifandraisana</h1>
<p class="error">${escapeHtml(message)}</p>
<a class="button" href="${APP_RETURN_URL}?connected=0">Hiverina amin’ny app</a>`,
  );
}
