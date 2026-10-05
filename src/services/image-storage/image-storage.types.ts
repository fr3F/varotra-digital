/**
 * Stockage des images de l'application. L'implémentation dépend de la plateforme :
 * - mobile : copie dans le dossier documents de l'app (image-storage.ts) ;
 * - web : data URI conservée telle quelle dans SQLite (image-storage.web.ts).
 */
export interface ImageStorage {
  /** Indique si l'URI est déjà gérée par l'application (pas besoin de la recopier). */
  isPersisted(uri: string): boolean;
  /** Copie une image temporaire (galerie, appareil photo) dans le stockage durable et renvoie sa nouvelle URI. */
  persist(sourceUri: string): Promise<string>;
  /** Supprime une image gérée par l'application. Sans effet sur une URI externe ou absente. */
  remove(uri: string): Promise<void>;
}
