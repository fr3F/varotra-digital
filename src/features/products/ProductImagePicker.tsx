import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  ImagePickerOptions,
  ImagePickerResult,
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { AppButton } from '@/shared/components/AppButton';
import { Thumbnail } from '@/shared/components/Thumbnail';

interface ProductImagePickerProps {
  readonly productName: string;
  /** URI courante ('' = pas d'image). */
  readonly imageUri: string;
  readonly onChange: (imageUri: string) => void;
  readonly disabled?: boolean;
}

/** Image carrée, compressée pour limiter la taille stockée. */
const PICKER_OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
};

function firstUri(result: ImagePickerResult): string | null {
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/**
 * Choix de l'image depuis la galerie ou l'appareil photo.
 * L'URI renvoyée est temporaire : le service produit la copie dans le stockage de l'app à l'enregistrement.
 */
export function ProductImagePicker({ productName, imageUri, onChange, disabled = false }: ProductImagePickerProps) {
  const [error, setError] = useState<string | null>(null);
  const canUseCamera = Platform.OS !== 'web';

  const pick = async (source: 'library' | 'camera') => {
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError("L'accès à l'appareil photo a été refusé.");
          return;
        }
      }
      const result =
        source === 'camera' ? await launchCameraAsync(PICKER_OPTIONS) : await launchImageLibraryAsync(PICKER_OPTIONS);
      const uri = firstUri(result);
      if (uri !== null) {
        onChange(uri);
      }
    } catch (caught: unknown) {
      setError(toErrorMessage(caught));
    }
  };

  const hasImage = imageUri.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Image</Text>
      <View style={styles.row}>
        <Thumbnail name={productName} imageUri={hasImage ? imageUri : null} size={96} />
        <View style={styles.actions}>
          <AppButton
            label={hasImage ? "Changer l'image" : 'Choisir une image'}
            variant="secondary"
            onPress={() => void pick('library')}
            disabled={disabled}
          />
          {canUseCamera ? (
            <AppButton label="Prendre une photo" variant="secondary" onPress={() => void pick('camera')} disabled={disabled} />
          ) : null}
          {hasImage ? (
            <AppButton label="Retirer l'image" variant="secondary" onPress={() => onChange('')} disabled={disabled} />
          ) : null}
        </View>
      </View>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  actions: { flex: 1, gap: spacing.sm },
  error: { marginTop: spacing.xs, color: colors.danger, fontSize: fontSize.sm },
});
