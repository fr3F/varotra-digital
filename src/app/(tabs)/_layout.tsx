import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Commandes',
          tabBarIcon: icon('receipt-outline', 'receipt'),
          tabBarBadge: newOrders > 0 ? newOrders : undefined,
        }}
      />
      <Tabs.Screen name="products" options={{ title: 'Produits', tabBarIcon: icon('pricetags-outline', 'pricetags') }} />
      <Tabs.Screen name="sales" options={{ title: 'Ventes', tabBarIcon: icon('cash-outline', 'cash') }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
