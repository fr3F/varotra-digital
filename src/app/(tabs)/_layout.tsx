import { Tabs } from 'expo-router';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { HeaderActions } from '@/features/notifications/HeaderActions';
import { colors, fontSize } from '@/core/theme/theme';

/**
 * Onglets principaux. Leur barre est dessinée par BottomNav (layout racine), pour rester visible
 * aussi sur les fiches ouvertes par-dessus (client, stock, produit…) : celle des Tabs est masquée.
 */
export default function TabsLayout() {
  const { tabs } = useMessages(commonMessages);

  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
        headerTintColor: colors.primary,
        // Cloche des notifications et choix de la langue (🇲🇬 / 🇫🇷 / 🇬🇧) sur les écrans principaux.
        headerRight: () => <HeaderActions />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tabs.home }} />
      {/* En-têtes gérés par la pile de l'onglet (liste puis détail). */}
      <Tabs.Screen name="orders" options={{ title: tabs.orders, headerShown: false }} />
      <Tabs.Screen name="products" options={{ title: tabs.products }} />
      <Tabs.Screen name="sales" options={{ title: tabs.sales }} />
      <Tabs.Screen name="settings" options={{ title: tabs.settings }} />
    </Tabs>
  );
}
