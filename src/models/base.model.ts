/** Identifiant UUID v4 : unique même entre appareils, prêt pour la synchronisation future. */
export type EntityId = string;

/** Date ISO 8601 en UTC (ex: 2026-10-02T08:30:00.000Z), comparable lexicographiquement. */
export type IsoDateString = string;

/** Montant entier dans l'unité minimale de la devise (l'Ariary n'a pas de centimes). */
export type Money = number;

export const SYNC_STATUSES = ['PENDING', 'SYNCED'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

/** Champs techniques communs à toutes les tables métier. */
export interface BaseEntity {
  readonly id: EntityId;
  readonly createdAt: IsoDateString;
  readonly updatedAt: IsoDateString;
  readonly syncStatus: SyncStatus;
}

/** Données saisies par l'utilisateur, sans les champs techniques. */
export type EntityInput<T extends BaseEntity> = Omit<T, keyof BaseEntity>;
