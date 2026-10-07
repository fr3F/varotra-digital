import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFacebookOAuth } from '../src/messenger/facebook-oauth.ts';

describe('connexion Facebook du vendeur', () => {
  it('redemande le choix des Pages à chaque connexion', () => {
    const oauth = createFacebookOAuth({ appId: '123', appSecret: 'secret', graphApiVersion: 'v25.0' });
    const url = new URL(oauth.loginUrl('https://serveur.test/connect/facebook/callback', 'etat'));
    assert.equal(url.origin + url.pathname, 'https://www.facebook.com/v25.0/dialog/oauth');
    assert.equal(url.searchParams.get('auth_type'), 'reauthorize');
    assert.equal(url.searchParams.get('scope'), 'pages_show_list,pages_messaging,pages_manage_metadata');
    assert.equal(url.searchParams.get('state'), 'etat');
  });
});
