import { createHash, randomInt, randomUUID } from 'node:crypto';
import { extendedExpiry, generateActivationCode, type Shop } from '../domain/shop.ts';
import { readNullableString, readNumber, readString, type Row, type SqlDb } from './sql.ts';

/** Durée de vie d'une connexion Facebook en cours. */
const OAUTH_SESSION_MS = 10 * 60 * 1000;

function toShop(row: Row): Shop {
  return {
    id: readString(row, 'id'),
    name: readString(row, 'name'),
    activationCode: readString(row, 'activation_code'),
    pageId: readNullableString(row, 'page_id'),
    pageName: readNullableString(row, 'page_name'),
    pageAccessToken: readNullableString(row, 'page_access_token'),
    expiresAt: readString(row, 'expires_at'),
    suspendedAt: readNullableString(row, 'suspended_at'),
    createdAt: readString(row, 'created_at'),
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** La Page est déjà reliée à une autre boutique. */
export class PageAlreadyLinkedError extends Error {}

/** Boutiques, authentification des téléphones et connexions Facebook (requêtes sans boutique courante). */
export function createShopRepository(db: SqlDb, now: () => Date = () => new Date()) {
  const iso = () => now().toISOString();
  return {
    async findById(id: string): Promise<Shop | null> {
      const row = await db.first('SELECT * FROM shops WHERE id = ?', [id]);
      return row === null ? null : toShop(row);
    },
    async findByPageId(pageId: string): Promise<Shop | null> {
      const row = await db.first('SELECT * FROM shops WHERE page_id = ?', [pageId]);
      return row === null ? null : toShop(row);
    },
    /** Code saisi dans l'application (majuscules, tirets et espaces indifférents). */
    async findByActivationCode(code: string): Promise<Shop | null> {
      const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const row = await db.first("SELECT * FROM shops WHERE replace(activation_code, '-', '') = ?", [normalized]);
      return row === null ? null : toShop(row);
    },
    async list(): Promise<Shop[]> {
      return (await db.all('SELECT * FROM shops ORDER BY created_at DESC')).map(toShop);
    },
    /** Boutiques avec le nombre de téléphones reliés (page d'administration). */
    async listWithDevices(): Promise<{ shop: Shop; devices: number }[]> {
      const rows = await db.all(
        `SELECT s.*, (SELECT COUNT(*) FROM devices AS d WHERE d.shop_id = s.id AND d.revoked_at IS NULL) AS device_count
         FROM shops AS s ORDER BY s.created_at DESC`,
      );
      return rows.map((row) => ({ shop: toShop(row), devices: readNumber(row, 'device_count') }));
    },
    /** Ancienne configuration à une seule Page : la boutique « default » adopte la Page qui écrit. */
    async claimPageForDefault(pageId: string): Promise<Shop | null> {
      await db.run("UPDATE shops SET page_id = ?, updated_at = ? WHERE id = 'default' AND page_id IS NULL", [pageId, iso()]);
      return this.findByPageId(pageId);
    },
    async create(name: string, months: number): Promise<Shop> {
      const id = randomUUID();
      const timestamp = iso();
      await db.run(
        `INSERT INTO shops (id, name, activation_code, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, generateActivationCode(randomInt), extendedExpiry(null, months, now()), timestamp, timestamp],
      );
      const shop = await this.findById(id);
      if (shop === null) {
        throw new Error('Boutique introuvable après création.');
      }
      return shop;
    },
    /** Prolonge l'abonnement de `months` mois (à partir de la fin actuelle si elle est future). */
    async extend(id: string, months: number): Promise<Shop | null> {
      const shop = await this.findById(id);
      if (shop === null) {
        return null;
      }
      await db.run('UPDATE shops SET expires_at = ?, updated_at = ? WHERE id = ?', [
        extendedExpiry(shop.expiresAt, months, now()),
        iso(),
        id,
      ]);
      return this.findById(id);
    },
    async setSuspended(id: string, suspended: boolean): Promise<Shop | null> {
      await db.run('UPDATE shops SET suspended_at = ?, updated_at = ? WHERE id = ?', [suspended ? iso() : null, iso(), id]);
      return this.findById(id);
    },
    async rename(id: string, name: string): Promise<void> {
      await db.run('UPDATE shops SET name = ?, updated_at = ? WHERE id = ?', [name, iso(), id]);
    },
    /** Relie la Page Facebook choisie par le vendeur ; refuse une Page déjà reliée à une autre boutique. */
    async linkPage(id: string, page: { id: string; name: string; accessToken: string }): Promise<void> {
      const owner = await this.findByPageId(page.id);
      if (owner !== null && owner.id !== id) {
        throw new PageAlreadyLinkedError(`La Page « ${page.name} » est déjà reliée à une autre boutique.`);
      }
      await db.run(
        'UPDATE shops SET page_id = ?, page_name = ?, page_access_token = ?, updated_at = ? WHERE id = ?',
        [page.id, page.name, page.accessToken, iso(), id],
      );
    },

    /** Téléphone actif correspondant au jeton (et sa boutique), ou null. Note la dernière activité. */
    async authenticateDevice(token: string): Promise<{ deviceId: string; shopId: string } | null> {
      const row = await db.first('SELECT id, shop_id FROM devices WHERE token_hash = ? AND revoked_at IS NULL', [
        hashToken(token),
      ]);
      if (row === null) {
        return null;
      }
      const deviceId = readString(row, 'id');
      await db.run('UPDATE devices SET last_seen_at = ? WHERE id = ?', [iso(), deviceId]);
      return { deviceId, shopId: readString(row, 'shop_id') };
    },

    /** Démarre une connexion Facebook pour la boutique ; l'identifiant sert de « state » OAuth. */
    async startOAuth(shopId: string): Promise<string> {
      const id = `${randomUUID()}${randomUUID()}`.replace(/-/g, '');
      await db.run('INSERT INTO oauth_sessions (id, shop_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
        id,
        shopId,
        iso(),
        new Date(now().getTime() + OAUTH_SESSION_MS).toISOString(),
      ]);
      return id;
    },
    /** Connexion Facebook encore valide : boutique et jeton utilisateur (après le retour de Facebook). */
    async findOAuth(id: string): Promise<{ shopId: string; userToken: string | null } | null> {
      const row = await db.first('SELECT shop_id, user_token FROM oauth_sessions WHERE id = ? AND expires_at > ?', [
        id,
        iso(),
      ]);
      return row === null ? null : { shopId: readString(row, 'shop_id'), userToken: readNullableString(row, 'user_token') };
    },
    async setOAuthUserToken(id: string, userToken: string): Promise<void> {
      await db.run('UPDATE oauth_sessions SET user_token = ? WHERE id = ?', [userToken, id]);
    },
    async endOAuth(id: string): Promise<void> {
      await db.run('DELETE FROM oauth_sessions WHERE id = ? OR expires_at < ?', [id, iso()]);
    },
  };
}

export type ShopRepository = ReturnType<typeof createShopRepository>;
