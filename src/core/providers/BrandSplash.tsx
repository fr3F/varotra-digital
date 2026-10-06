import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/core/theme/theme';

/**
 * Écran de démarrage de l'application (logo sur fond rouge), affiché pendant l'ouverture de la base.
 * Prolonge l'écran de lancement natif (expo-splash-screen) et reste visible dans Expo Go.
 */
export function BrandSplash() {
  return (
    <View style={styles.screen} accessibilityLabel="Carnet Digital, chargement">
      <Image source={require('../../../assets/splash-logo.png')} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color={colors.onPrimary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 240, height: 120 },
  spinner: { marginTop: spacing.xl },
});
