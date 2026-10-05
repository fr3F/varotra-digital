import { Directory, File, Paths } from 'expo-file-system';
import { generateId } from '@/utils/id.utils';
import { ImageStorage } from './image-storage.types';

const IMAGES_DIRECTORY_NAME = 'product-images';

function imagesDirectory(): Directory {
  const directory = new Directory(Paths.document, IMAGES_DIRECTORY_NAME);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function extensionOf(uri: string): string {
  const match = /\.([a-z0-9]{2,5})(?:\?.*)?$/i.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

export const imageStorage: ImageStorage = {
  isPersisted(uri) {
    return uri.startsWith(imagesDirectory().uri);
  },

  async persist(sourceUri) {
    if (imageStorage.isPersisted(sourceUri)) {
      return sourceUri;
    }
    const destination = new File(imagesDirectory(), `${generateId()}.${extensionOf(sourceUri)}`);
    await new File(sourceUri).copy(destination);
    return destination.uri;
  },

  async remove(uri) {
    if (!imageStorage.isPersisted(uri)) {
      return;
    }
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  },
};
