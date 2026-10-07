import { Stack } from 'expo-router';
import { colors, fontSize } from '@/core/theme/theme';
import { HeaderActions } from '@/features/notifications/HeaderActions';

// Ouvert directement sur une commande (notification) : la liste reste dessous pour « Retour ».
export const unstable_settings = { initialRouteName: 'index' };

/** Onglet Commandes : liste et détail empilés dans l'onglet, la barre d'onglets reste visible. */
export default function OrdersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerRight: () => <HeaderActions />,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* La liste garde le grand titre des autres onglets. */}
      <Stack.Screen
        name="index"
        options={{ headerTitleAlign: 'left', headerTitleStyle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text } }}
      />
    </Stack>
  );
}
