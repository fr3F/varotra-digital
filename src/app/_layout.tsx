import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BottomNav } from '@/core/navigation/BottomNav';
import { DatabaseProvider } from '@/core/providers/DatabaseProvider';
import { LanguageBridge } from '@/core/providers/LanguageBridge';
import { HeaderActions } from '@/features/notifications/HeaderActions';
import { MessengerSyncBridge } from '@/core/providers/MessengerSyncBridge';
import { NotificationBridge } from '@/core/providers/NotificationBridge';
import { useStore } from '@/core/state/store';
import { colors } from '@/core/theme/theme';
import { onboardingService, onboardingStore } from '@/services/onboarding.service';

// Affiche un écran d'erreur (avec bouton « Réessayer ») si un écran plante.
export { ErrorBoundary } from 'expo-router';

/** Navigation : le guide du premier lancement passe avant les onglets, une seule fois. */
function AppStack() {
  const onboardingDone = useStore(onboardingStore);
  useEffect(() => {
    void onboardingService.load();
  }, []);
  // Le temps de lire l'indicateur (quelques ms) : rien, pour ne pas montrer les onglets puis le guide.
  if (onboardingDone === null) {
    return null;
  }
  return (
    <View style={styles.app}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          // Cloche des notifications et choix de la langue sur tous les écrans.
          headerRight: () => <HeaderActions />,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Onglets (accueil, commandes, produits, ventes, réglages) : en-têtes gérés par les onglets. */}
        <Stack.Protected guard={onboardingDone}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboardingDone}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {/* Barre de navigation sous tous les écrans, sauf pendant le guide du premier lancement. */}
      {onboardingDone ? <BottomNav /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
});

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <LanguageBridge>
        <NotificationBridge>
          <MessengerSyncBridge>
            <StatusBar style="dark" />
            <AppStack />
          </MessengerSyncBridge>
        </NotificationBridge>
      </LanguageBridge>
    </DatabaseProvider>
  );
}
