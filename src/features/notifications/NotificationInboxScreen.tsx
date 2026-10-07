import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMessages } from '@/core/i18n/i18n';
import { openNotificationTarget } from '@/core/navigation/open-target';
import { useStore } from '@/core/state/store';
import { colors, fontSize, radius, shadow, spacing } from '@/core/theme/theme';
import { InboxNotification, NotificationType } from '@/models';
import { inboxService, inboxStore } from '@/services/notifications/inbox.service';
import { EmptyState } from '@/shared/components/StatusViews';
import { confirmAction } from '@/shared/utils/confirm';
import { inboxMessages } from './notifications-inbox.messages';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icône et couleur de chaque type d'événement. */
const TYPE_STYLES: Readonly<Record<NotificationType, { icon: IconName; color: string; background: string }>> = {
  NEW_ORDER: { icon: 'receipt', color: colors.primary, background: colors.primaryLight },
  ORDER_COMPLETED: { icon: 'checkmark-done', color: colors.success, background: colors.successLight },
  LOW_STOCK: { icon: 'alert-circle', color: colors.warning, background: colors.warningLight },
  SYNC_ERROR: { icon: 'cloud-offline', color: colors.danger, background: colors.dangerLight },
};

type Messages = (typeof inboxMessages)['fr'];

/** « à l'instant », « il y a 5 min », « il y a 3 h », « hier », sinon la date. */
function timeAgo(iso: string, t: Messages): string {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) {
    return t.justNow;
  }
  if (minutes < 60) {
    return t.minutesAgo(minutes);
  }
  if (minutes < 24 * 60) {
    return t.hoursAgo(Math.floor(minutes / 60));
  }
  if (minutes < 48 * 60) {
    return t.yesterday;
  }
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function InboxRow({ item, t }: { readonly item: InboxNotification; readonly t: Messages }) {
  const unread = item.readAt === null;
  const style = TYPE_STYLES[item.type];
  const open = () => {
    void inboxService.markRead(item.id);
    if (item.target !== null) {
      openNotificationTarget(item.target);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: style.background }]}>
        <Ionicons name={style.icon} size={22} color={style.color} />
      </View>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt, t)}</Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

/** Centre de notifications : historique des événements, du plus récent au plus ancien. */
export function NotificationInboxScreen() {
  const t = useMessages(inboxMessages);
  const { items, unread } = useStore(inboxStore);

  const clear = async () => {
    if (await confirmAction(t.clearConfirmTitle, t.clearConfirmMessage, t.clear)) {
      await inboxService.clear();
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t.title }} />
      {items.length > 0 ? (
        <View style={styles.toolbar}>
          <Text style={styles.count}>{t.unreadCount(unread)}</Text>
          <View style={styles.actions}>
            {unread > 0 ? (
              <Text accessibilityRole="button" onPress={() => void inboxService.markAllRead()} style={styles.link}>
                {t.markAllRead}
              </Text>
            ) : null}
            <Text accessibilityRole="button" onPress={() => void clear()} style={styles.linkMuted}>
              {t.clear}
            </Text>
          </View>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InboxRow item={item} t={t} />}
        contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={<EmptyState icon="notifications-outline" title={t.emptyTitle} message={t.emptyMessage} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  count: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.lg },
  link: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  linkMuted: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  list: { paddingBottom: spacing.xl },
  emptyList: { flexGrow: 1 },
  row: {
    ...shadow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  rowUnread: { backgroundColor: colors.primaryLight },
  pressed: { opacity: 0.85 },
  icon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  titleUnread: { fontWeight: '800' },
  time: { fontSize: 12, color: colors.textMuted },
  body: { fontSize: fontSize.sm, color: colors.textMuted },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
});
