import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_MESSENGER_BACKEND_URL } from '@/core/constants/app.constants';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { messengerStore } from '@/services/messenger/messenger-state';
import { messengerSyncService } from '@/services/messenger/messenger-sync.service';
import { AppButton } from '@/shared/components/AppButton';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { confirmAction } from '@/shared/utils/confirm';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { settingsMessages } from './settings.messages';

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  readonly label: string;
  readonly description: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTexts}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.muted}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

/** Liaison avec le serveur Messenger : connexion par code, état de la synchro, réglages. */
export function MessengerSettingsSection() {
  const t = useMessages(settingsMessages).messenger;
  const state = useStore(messengerStore);
  const [url, setUrl] = useState(DEFAULT_MESSENGER_BACKEND_URL);
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState(t.defaultDeviceName);
  const [report, setReport] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(String(state.deliveryFee));
  const { busy, error, run } = useAsyncAction();

  const describe = (imported: number, sent: number) => t.syncReport(imported, sent);

  const connect = () =>
    run(async () => {
      const result = await messengerSyncService.connect(url, code, deviceName);
      setCode('');
      setReport(describe(result.imported, result.customerUpdatesSent));
    });

  const syncNow = () =>
    run(async () => {
      const result = await messengerSyncService.sync();
      setReport(describe(result.imported, result.customerUpdatesSent));
    });

  const saveDeliveryFee = () =>
    run(async () => {
      await messengerSyncService.setDeliveryFee(deliveryFee);
      setReport(t.deliveryFeeSaved(formatMoney(messengerStore.get().deliveryFee)));
    });

  const disconnect = async () => {
    if (await confirmAction(t.disconnectTitle, t.disconnectMessage, t.disconnect)) {
      await run(() => messengerSyncService.disconnect());
      setReport(null);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t.title}</Text>
      <ErrorBanner message={error} />

      {!state.connected ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{t.intro}</Text>
          <View style={styles.spacer} />
          <FormField
            label={t.serverUrl}
            value={url}
            onChangeText={setUrl}
            placeholder={t.serverUrlPlaceholder}
            keyboardType="url"
          />
          <FormField label={t.pairingCode} value={code} onChangeText={setCode} placeholder={t.pairingCodePlaceholder} />
          <FormField label={t.deviceName} value={deviceName} onChangeText={setDeviceName} />
          <AppButton label={t.connect} onPress={() => void connect()} loading={busy} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.connected}>{t.connectedTo(state.backendUrl ?? '')}</Text>
          <Text style={styles.muted}>
            {state.syncing
              ? t.syncing
              : state.lastSyncAt === null
                ? t.neverSynced
                : t.lastSync(formatDisplayDateTime(state.lastSyncAt))}
          </Text>
          <Text style={styles.muted}>
            {state.pushActive ? t.pushActive : t.pushInactive}
          </Text>
          {state.lastError !== null ? <Text style={styles.errorText}>{t.lastError(state.lastError)}</Text> : null}
          {report !== null ? <Text style={styles.report}>{report}</Text> : null}
          <View style={styles.spacer} />
          <ToggleRow
            label={t.autoReply}
            description={t.autoReplyDescription}
            value={state.autoReply}
            onChange={(value) => void run(() => messengerSyncService.setAutoReply(value))}
          />
          <ToggleRow
            label={t.notifyCustomer}
            description={t.notifyCustomerDescription}
            value={state.notifyCustomer}
            onChange={(value) => void run(() => messengerSyncService.setNotifyCustomer(value))}
          />
          <View style={styles.spacer} />
          <FormField
            label={t.deliveryFee}
            value={deliveryFee}
            onChangeText={setDeliveryFee}
            keyboardType="number-pad"
          />
          <Text style={styles.muted}>{t.deliveryFeeHint}</Text>
          <AppButton
            label={t.saveDeliveryFee}
            variant="secondary"
            onPress={() => void saveDeliveryFee()}
            loading={busy}
            disabled={deliveryFee === String(state.deliveryFee)}
          />
          <View style={styles.actions}>
            <AppButton label={t.syncNow} onPress={() => void syncNow()} loading={busy || state.syncing} />
            <AppButton
              label={t.replyHistory}
              variant="secondary"
              onPress={() => router.push('/messenger-replies')}
            />
            <AppButton label={t.disconnect} variant="secondary" onPress={() => void disconnect()} disabled={busy} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  connected: { fontSize: fontSize.md, fontWeight: '700', color: colors.success },
  errorText: { fontSize: fontSize.sm, color: colors.danger },
  report: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  spacer: { height: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  toggleTexts: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
