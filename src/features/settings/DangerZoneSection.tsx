import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize } from '@/core/theme/theme';
import { resetService } from '@/services/reset.service';
import { AppButton } from '@/shared/components/AppButton';
import { Drawer } from '@/shared/components/Drawer';
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
    <Drawer title={t.title} icon="warning-outline" tone="danger">
      <ErrorBanner message={error} />
      {message !== null ? <Text style={styles.done}>{message}</Text> : null}
      <AppButton label={t.cardTitle} variant="danger" onPress={() => void deleteAll()} loading={busy} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  done: { fontSize: fontSize.sm, fontWeight: '600', color: colors.success },
});
