import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { NOTIFICATION_TYPES, NotificationPermission, NotificationType } from '@/models';
import { notificationPreferencesStore, notificationService } from '@/services/notifications/notification.service';
import { AppButton } from '@/shared/components/AppButton';
import { Drawer } from '@/shared/components/Drawer';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { DangerZoneSection } from './DangerZoneSection';
import { LanguageSection } from './LanguageSection';
import { MessengerSettingsSection } from './MessengerSettingsSection';
import { settingsMessages } from './settings.messages';

export function NotificationSettingsScreen() {
  const t = useMessages(settingsMessages);
  const common = useMessages(commonMessages);
  const preferences = useStore(notificationPreferencesStore);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // L'autorisation a pu changer dans les paramètres du téléphone.
  useFocusEffect(
    useCallback(() => {
      void notificationService.getPermission().then(setPermission);
    }, []),
  );

  const toggle = async (type: NotificationType, enabled: boolean) => {
    try {
      setError(null);
      await notificationService.setEnabled(type, enabled);
    } catch (caught: unknown) {
      setError(toErrorMessage(caught));
    }
  };

  const request = async () => {
    setPermission(await notificationService.requestPermission());
  };

  const test = async (type: NotificationType) => {
    setMessage(null);
    const sent = await notificationService.sendTest(type);
    setPermission(await notificationService.getPermission());
    setMessage(sent ? t.testSent : t.testFailed);
  };

  // Rien à dire quand tout va bien : la carte n'apparaît que si les notifications ne passent pas.
  const permissionText = permission === null || permission === 'granted' ? null : t.permission[permission];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.title }} />
      <LanguageSection />
      <MessengerSettingsSection />
      <Drawer title={t.notifications} icon="notifications-outline" summary={permissionText}>
        <ErrorBanner message={error} />
        {/* L'état (bloquées, non autorisées) est déjà dans l'en-tête du tiroir : ici, seulement quoi faire. */}
        {permission === 'denied' ? <Text style={styles.muted}>{t.deniedPath}</Text> : null}
        {permission === 'undetermined' ? (
          <AppButton label={t.allowNotifications} onPress={() => void request()} />
        ) : null}

        <View>
          {NOTIFICATION_TYPES.map((type) => (
            <View key={type} style={styles.row}>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>{common.notificationType[type]}</Text>
                <Text accessibilityRole="button" onPress={() => void test(type)} style={styles.testLink}>
                  {t.sendTest}
                </Text>
              </View>
              <Switch
                accessibilityLabel={common.notificationType[type]}
                value={preferences[type]}
                onValueChange={(enabled) => void toggle(type, enabled)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
          ))}
        </View>
        {message !== null ? <Text style={styles.feedback}>{message}</Text> : null}
      </Drawer>

      <DangerZoneSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  testLink: { marginTop: spacing.xs, fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  feedback: { fontSize: fontSize.sm, color: colors.text, textAlign: 'center' },
});
