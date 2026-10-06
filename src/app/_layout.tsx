import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@/core/providers/DatabaseProvider';
import { LanguageBridge } from '@/core/providers/LanguageBridge';
import { MessengerSyncBridge } from '@/core/providers/MessengerSyncBridge';
import { NotificationBridge } from '@/core/providers/NotificationBridge';
import { colors } from '@/core/theme/theme';

// Affiche un écran d'erreur (avec bouton « Réessayer ») si un écran plante.
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <LanguageBridge>
        <NotificationBridge>
          <MessengerSyncBridge>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.primary,
                headerTitleStyle: { fontWeight: '700', color: colors.text },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              {/* Onglets (accueil, commandes, produits, ventes, réglages) : en-têtes gérés par les onglets. */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </MessengerSyncBridge>
        </NotificationBridge>
      </LanguageBridge>
    </DatabaseProvider>
  );
}
