import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@/core/providers/DatabaseProvider';
import { MessengerSyncBridge } from '@/core/providers/MessengerSyncBridge';
import { NotificationBridge } from '@/core/providers/NotificationBridge';
import { colors } from '@/core/theme/theme';

// Affiche un écran d'erreur (avec bouton « Réessayer ») si un écran plante.
export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <NotificationBridge>
        <MessengerSyncBridge>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.onPrimary,
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </MessengerSyncBridge>
      </NotificationBridge>
    </DatabaseProvider>
  );
}
