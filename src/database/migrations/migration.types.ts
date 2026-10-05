export interface Migration {
  /** Numéro croissant, stocké dans PRAGMA user_version. */
  readonly version: number;
  readonly name: string;
  /** Script SQL (plusieurs instructions autorisées, jamais de saisie utilisateur). */
  readonly sql: string;
}
