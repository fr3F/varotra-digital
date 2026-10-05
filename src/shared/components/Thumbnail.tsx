import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/core/theme/theme';

interface ThumbnailProps {
  readonly name: string;
  readonly imageUri: string | null;
  readonly size?: number;
}

/** Image (produit), ou initiales du nom (produit sans image, client). */
export function Thumbnail({ name, imageUri, size = 48 }: ThumbnailProps) {
  const dimension = { width: size, height: size, borderRadius: size > 64 ? radius.lg : radius.md };

  if (imageUri !== null && imageUri.length > 0) {
    return (
      <Image
        accessibilityLabel={`Image de ${name}`}
        source={{ uri: imageUri }}
        style={[styles.image, dimension]}
        resizeMode="cover"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

  return (
    <View style={[styles.placeholder, dimension]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  placeholder: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '700', color: colors.primaryDark },
});
