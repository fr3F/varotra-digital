import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig } from '../src/config.ts';

const base = {
  META_APP_SECRET: 'secret-de-test',
  META_VERIFY_TOKEN: 'jeton-de-verification',
  APP_PAIRING_CODE: 'CODE-APPAIRAGE',
};

describe('configuration', () => {
  it('place la base dans le volume Railway quand il est attaché', () => {
    assert.equal(loadConfig({ ...base, RAILWAY_VOLUME_MOUNT_PATH: '/data/' }).databasePath, '/data/carnet-backend.db');
  });

  it('DATABASE_PATH reste prioritaire, et le port vient de PORT (fourni par Railway)', () => {
    const config = loadConfig({ ...base, DATABASE_PATH: '/tmp/x.db', RAILWAY_VOLUME_MOUNT_PATH: '/data', PORT: '8080' });
    assert.equal(config.databasePath, '/tmp/x.db');
    assert.equal(config.port, 8080);
    assert.equal(config.devTools, false);
  });

  it('refuse un code d’appairage trop court', () => {
    assert.throws(() => loadConfig({ ...base, APP_PAIRING_CODE: '123' }), ConfigError);
  });

  it('lien de l’APK : https seulement, facultatif', () => {
    assert.equal(loadConfig(base).apkUrl, null);
    assert.equal(loadConfig({ ...base, APK_URL: 'https://expo.dev/a.apk' }).apkUrl, 'https://expo.dev/a.apk');
    assert.throws(() => loadConfig({ ...base, APK_URL: 'http://exemple.mg/a.apk' }), ConfigError);
  });
});
