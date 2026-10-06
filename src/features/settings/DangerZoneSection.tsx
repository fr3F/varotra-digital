import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { resetService } from '@/services/reset.service';
import { AppButton } from '@/shared/components/AppButton';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { confirmAction } from '@/shared/utils/confirm';
import { settingsMessages } from './settings.messages';

/** Réglages › Zone de danger : suppression de toutes les données, avec double confirmation. */
export function DangerZoneSection() {
  const t = useMessages(settingsMessages).danger;
  const common = useMessages(commonMessages);
  const { busy, error, run } = useAsyncAction();
  const [message, setMessage] = useState<string | null>(null);

  const deleteAll = async () => {
    setMessage(null);
    const summary = await resetService.summary();
    const details = t.summary(summary.products, summary.orders, summary.sales, summary.clients, summary.expenses);
    const first = await confirmAction(t.firstTitle, t.firstMessage(details), common.actions.continue);
    if (!first) {
      return;
    }
    const second = await confirmAction(t.secondTitle, t.secondMessage, t.deleteAll);
    if (!second) {
      return;
    }
    const done = await run(() => resetService.deleteAllData());
    if (done) {
      setMessage(t.done);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t.title}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.cardTitle}</Text>
        <Text style={styles.muted}>{t.description}</Text>
        <ErrorBanner message={error} />
        {message !== null ? <Text style={styles.done}>{message}</Text> : null}
        <View style={styles.spaced}>
          <AppButton label={t.cardTitle} variant="danger" onPress={() => void deleteAll()} loading={busy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.danger },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  done: { fontSize: fontSize.sm, fontWeight: '600', color: colors.success },
  spaced: { marginTop: spacing.md },
});
