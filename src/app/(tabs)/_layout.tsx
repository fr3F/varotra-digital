import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { HeaderActions } from '@/features/notifications/HeaderActions';
import { useStore } from '@/core/state/store';
import { colors, fontSize, radius, shadow, spacing } from '@/core/theme/theme';
import { orderStore } from '@/services/order.service';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName, focusedName: IconName) {
  function TabIcon({ color, focused }: { readonly color: ColorValue; readonly focused: boolean }) {
    return <Ionicons name={focused ? focusedName : name} size={24} color={color} />;
  }
  return TabIcon;
}

/** Barre d'onglets rouge en pilule (modèle « Bite ») ; pastille = commandes nouvelles à traiter. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { tabs } = useMessages(commonMessages);
  const orders = useStore(orderStore);
  const newOrders = orders.items.filter((summary) => summary.order.status === 'NEW').length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
        headerTintColor: colors.primary,
        // Cloche des notifications et choix de la langue (🇲🇬 / 🇫🇷 / 🇬🇧) sur les écrans principaux.
        headerRight: () => <HeaderActions />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.onPrimary,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        tabBarStyle: {
          ...shadow,
          backgroundColor: colors.primary,
          borderTopWidth: 0,
          borderRadius: radius.pill,
          marginHorizontal: spacing.lg,
          marginBottom: Math.max(insets.bottom, spacing.md),
          height: 60,
          paddingBottom: 0,
        },
        tabBarItemStyle: { justifyContent: 'center', paddingTop: spacing.sm + 2 },
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.text, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tabs.home, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: tabs.orders,
          // En-têtes gérés par la pile de l'onglet (liste puis détail).
          headerShown: false,
          tabBarIcon: icon('receipt-outline', 'receipt'),
          tabBarBadge: newOrders > 0 ? newOrders : undefined,
        }}
      />
      <Tabs.Screen name="products" options={{ title: tabs.products, tabBarIcon: icon('cube-outline', 'cube') }} />
      <Tabs.Screen name="sales" options={{ title: tabs.sales, tabBarIcon: icon('cash-outline', 'cash') }} />
      <Tabs.Screen name="settings" options={{ title: tabs.settings, tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
