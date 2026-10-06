import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMessages } from '@/core/i18n/i18n';
import { useStore } from '@/core/state/store';
import { colors, radius } from '@/core/theme/theme';
import { inboxStore } from '@/services/notifications/inbox.service';
import { inboxMessages } from './notifications-inbox.messages';

/** Cloche de l'en-tête : pastille rouge = notifications non lues ; un appui ouvre le centre de notifications. */
export function NotificationBell() {
  const t = useMessages(inboxMessages);
  const { unread } = useStore(inboxStore);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.open(unread)}
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={22} color={colors.primary} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
});
