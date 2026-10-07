import { ComponentProps, useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Href, router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { useStore } from '@/core/state/store';
import { colors, radius, shadow, spacing } from '@/core/theme/theme';
import { orderStore } from '@/services/order.service';

type IconName = ComponentProps<typeof Ionicons>['name'];
type TabKey = 'home' | 'orders' | 'products' | 'sales' | 'settings';

interface NavItem {
  readonly key: TabKey;
  readonly href: Href;
  readonly icon: IconName;
  readonly activeIcon: IconName;
}

const ITEMS: readonly NavItem[] = [
  { key: 'home', href: '/', icon: 'home-outline', activeIcon: 'home' },
  { key: 'orders', href: '/orders', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'products', href: '/products', icon: 'cube-outline', activeIcon: 'cube' },
  { key: 'sales', href: '/sales', icon: 'cash-outline', activeIcon: 'cash' },
  { key: 'settings', href: '/settings', icon: 'settings-outline', activeIcon: 'settings' },
];

/** Onglet allumé pour l'écran affiché ; les écrans annexes allument l'onglet dont ils dépendent. */
function activeTab(pathname: string): TabKey | null {
  const first = pathname.split('/')[1] ?? '';
  switch (first) {
    case '':
      return 'home';
    case 'orders':
    case 'clients':
      return 'orders';
    case 'products':
    case 'stock':
      return 'products';
    case 'sales':
    case 'expenses':
      return 'sales';
    case 'settings':
    case 'messenger-replies':
      return 'settings';
    default:
      return null;
  }
}

/**
 * Barre de navigation rouge en pilule, affichée sous tous les écrans (onglets et fiches) :
 * on change de rubrique depuis n'importe où. Masquée pendant la saisie (clavier ouvert).
 */
export function BottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { tabs } = useMessages(commonMessages);
  const orders = useStore(orderStore);
  const newOrders = orders.items.filter((summary) => summary.order.status === 'NEW').length;
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  if (keyboardOpen) {
    return null;
  }
  const current = activeTab(pathname);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {ITEMS.map((item) => {
          const active = item.key === current;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={tabs[item.key]}
              accessibilityState={{ selected: active }}
              // navigate : revient à l'onglet existant (et ferme les fiches ouvertes par-dessus).
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={24}
                color={active ? colors.onPrimary : 'rgba(255,255,255,0.6)'}
              />
              {item.key === 'orders' && newOrders > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{newOrders > 99 ? '99+' : newOrders}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.background },
  bar: {
    ...shadow,
    flexDirection: 'row',
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: 8,
    left: '52%',
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
});
