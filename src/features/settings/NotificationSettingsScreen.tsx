import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import {
  NOTIFICATION_TYPE_DESCRIPTIONS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  NotificationPermission,
  NotificationType,
} from '@/models';
import { notificationPreferencesStore, notificationService } from '@/services/notifications/notification.service';
import { AppButton } from '@/shared/components/AppButton';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { MessengerSettingsSection } from './MessengerSettingsSection';

const PERMISSION_TEXTS: Readonly<Record<NotificationPermission, { title: string; message: string }>> = {
  granted: { title: 'Notifications autorisées', message: 'Carnet Digital peut vous prévenir sur cet appareil.' },
  undetermined: {
    title: 'Autorisation pas encore demandée',
    message: 'Autorisez les notifications pour être prévenu des commandes et du stock.',
  },
  denied: {
    title: 'Notifications bloquées',
    message: 'Réactivez-les dans les paramètres du téléphone (Applications › Carnet Digital › Notifications).',
  },
  unsupported: { title: 'Non disponible', message: 'Ce navigateur ne gère pas les notifications.' },
};

export function NotificationSettingsScreen() {
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
    setMessage(sent ? 'Notification de test envoyée.' : 'Impossible d’envoyer : les notifications ne sont pas autorisées.');
  };

  const permissionText = permission === null ? null : PERMISSION_TEXTS[permission];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Réglages' }} />
      <MessengerSettingsSection />
      <Text style={styles.sectionTitle}>Notifications</Text>
      <ErrorBanner message={error} />
      {permissionText !== null ? (
        <View style={[styles.card, permission === 'granted' ? styles.okCard : styles.warnCard]}>
          <Text style={styles.cardTitle}>{permissionText.title}</Text>
          <Text style={styles.muted}>{permissionText.message}</Text>
          {permission === 'undetermined' ? (
            <View style={styles.spaced}>
              <AppButton label="Autoriser les notifications" onPress={() => void request()} />
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Me prévenir pour…</Text>
      <View style={styles.list}>
        {NOTIFICATION_TYPES.map((type) => (
          <View key={type} style={styles.row}>
            <View style={styles.rowTexts}>
              <Text style={styles.rowTitle}>{NOTIFICATION_TYPE_LABELS[type]}</Text>
              <Text style={styles.muted}>{NOTIFICATION_TYPE_DESCRIPTIONS[type]}</Text>
              <Text accessibilityRole="button" onPress={() => void test(type)} style={styles.testLink}>
                Envoyer un test
              </Text>
            </View>
            <Switch
              accessibilityLabel={NOTIFICATION_TYPE_LABELS[type]}
              value={preferences[type]}
              onValueChange={(enabled) => void toggle(type, enabled)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        ))}
      </View>
      {message !== null ? <Text style={styles.feedback}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.xs },
  okCard: { backgroundColor: colors.successLight },
  warnCard: { backgroundColor: colors.warningLight },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  spaced: { marginTop: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  testLink: { marginTop: spacing.xs, fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  feedback: { fontSize: fontSize.sm, color: colors.text, textAlign: 'center' },
});
