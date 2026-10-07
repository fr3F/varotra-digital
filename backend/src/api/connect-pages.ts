/**
 * Pages affichées dans le navigateur pendant « Se connecter avec Facebook » (ouvert par
 * l'application) : choix de la Page, succès, erreur. Le bouton final rouvre l'application.
 */
import type { FacebookPage } from '../messenger/facebook-oauth.ts';
import { escapeHtml } from './legal-pages.ts';

/** Adresse qui rouvre l'application (schéma déclaré dans app.json). */
export const APP_RETURN_URL = 'carnetdigital://messenger';

/**
 * Adresse de retour envoyée par l'application ({ returnUrl }) : son schéma (APK) ou exp://… (Expo
 * Go, qui ne connaît pas carnetdigital://). Toute autre adresse est refusée (pas de redirection ouverte).
 */
export function parseReturnUrl(body: unknown): string | null {
  const value = typeof body === 'object' && body !== null ? (body as { returnUrl?: unknown }).returnUrl : null;
  return typeof value === 'string' && value.length <= 300 && /^(carnetdigital|exps?):\/\/[^\s"'<>]*$/.test(value)
    ? value
    : null;
}

function returnLink(returnUrl: string, connected: boolean): string {
  return `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}connected=${connected ? 1 : 0}`;
}

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
  .secondary { background: transparent; color: #A3161D; text-decoration: underline; }
  .error { color: #b42318; font-weight: 600; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Choix de la Page à relier à la boutique. */
export function choosePageHtml(
  state: string,
  pages: readonly FacebookPage[],
  accountName: string | null = null,
): string {
  const account =
    accountName === null ? '' : `<p class="muted">Kaonty Facebook: <strong>${escapeHtml(accountName)}</strong></p>`;
  // Facebook ne renvoie que les Pages cochées lors de la connexion : ce bouton efface l'autorisation
  // et relance la connexion, pour cocher une autre Page ou passer à un autre compte.
  const other = `<form method="post" action="/connect/facebook/other">
  <input type="hidden" name="state" value="${escapeHtml(state)}">
  <button class="secondary" type="submit">Page hafa na kaonty Facebook hafa</button>
</form>`;
  if (pages.length === 0) {
    return layout(
      'Tsy misy Page',
      `<h1>Tsy nahitana Page</h1>
${account}
<p class="error">Mariho ny Page ao amin’ny Facebook.</p>
${other}`,
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
${account}
${buttons}
${other}`,
  );
}

/** Page reliée : retour automatique dans l'application. */
/** returnUrl : adresse envoyée par l'application (null : celle de l'APK). */
export function connectedHtml(pageName: string, returnUrl: string | null = null): string {
  const back = escapeHtml(returnLink(returnUrl ?? APP_RETURN_URL, true));
  return layout(
    'Vita',
    `<h1>Vita ✅</h1>
<p><strong>${escapeHtml(pageName)}</strong></p>
<a class="button" href="${back}">Hiverina amin’ny app</a>`,
    `<meta http-equiv="refresh" content="1;url=${back}">`,
  );
}

export function errorHtml(message: string, returnUrl: string | null = null): string {
  return layout(
    'Tsy vita',
    `<h1>Tsy vita ny fampifandraisana</h1>
<p class="error">${escapeHtml(message)}</p>
<a class="button" href="${escapeHtml(returnLink(returnUrl ?? APP_RETURN_URL, false))}">Hiverina amin’ny app</a>`,
  );
}
