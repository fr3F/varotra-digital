import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFacebookOAuth } from '../src/messenger/facebook-oauth.ts';

describe('connexion Facebook du vendeur', () => {
  it('redemande le choix des Pages à chaque connexion', () => {
    const oauth = createFacebookOAuth({ appId: '123', appSecret: 'secret', graphApiVersion: 'v25.0' });
    const url = new URL(oauth.loginUrl('https://serveur.test/connect/facebook/callback', 'etat'));
    assert.equal(url.origin + url.pathname, 'https://www.facebook.com/v25.0/dialog/oauth');
    assert.equal(url.searchParams.get('auth_type'), 'reauthorize');
    assert.equal(url.searchParams.get('scope'), 'pages_show_list,pages_messaging,pages_manage_metadata,business_management');
    assert.equal(url.searchParams.get('state'), 'etat');
  });

  it('retire l’autorisation de l’application et lit le nom du compte', async () => {
    const calls: { method: string; url: URL }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      calls.push({ method: init?.method ?? 'GET', url });
      return Response.json(url.pathname.endsWith('/me') ? { name: 'Rakoto Jean' } : { success: true });
    };
    const oauth = createFacebookOAuth({ appId: '123', appSecret: 'secret', graphApiVersion: 'v25.0', fetchImpl });
    assert.equal(await oauth.userName('jeton'), 'Rakoto Jean');
    await oauth.revokeApp('jeton');
    assert.equal(calls[1]?.method, 'DELETE');
    assert.equal(calls[1]?.url.pathname, '/v25.0/me/permissions');
    assert.equal(calls[1]?.url.searchParams.get('access_token'), 'jeton');
  });

  it('nom du compte inconnu si Facebook refuse', async () => {
    const fetchImpl: typeof fetch = async () => Response.json({ error: { message: 'Invalid token' } }, { status: 400 });
    const oauth = createFacebookOAuth({ appId: '123', appSecret: 'secret', graphApiVersion: 'v25.0', fetchImpl });
    assert.equal(await oauth.userName('jeton'), null);
  });
});
