import { ImageStorage } from './image-storage.types';

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("Lecture de l'image impossible."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Web : pas de système de fichiers. L'image est conservée sous forme de data URI
 * directement dans SQLite (une URL blob: ne survivrait pas au rechargement de la page).
 */
export const imageStorage: ImageStorage = {
  isPersisted(uri) {
    return uri.startsWith('data:');
  },

  async persist(sourceUri) {
    if (imageStorage.isPersisted(sourceUri)) {
      return sourceUri;
    }
    const response = await fetch(sourceUri);
    return blobToDataUri(await response.blob());
  },

  async remove() {
    // Rien à supprimer : l'image disparaît avec la ligne SQLite.
  },
};
