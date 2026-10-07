import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_MESSENGER_BACKEND_URL } from '@/core/constants/app.constants';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { messengerStore } from '@/services/messenger/messenger-state';
import { messengerSyncService } from '@/services/messenger/messenger-sync.service';
import { AppButton } from '@/shared/components/AppButton';
import { Drawer } from '@/shared/components/Drawer';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { confirmAction } from '@/shared/utils/confirm';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { settingsMessages } from './settings.messages';

function ToggleRow({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
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
  // Fermé : la Page reliée (ou la boutique) suffit à savoir où l'on en est.
  const summary = state.connected ? (state.shop?.pageName ?? state.shop?.name ?? null) : null;

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

  const connectFacebook = () =>
    run(async () => {
      const linked = await messengerSyncService.connectFacebook();
      const page = messengerStore.get().shop?.pageName ?? '';
      setReport(linked ? t.pageConnected(page) : t.noPage);
    });

  const disconnect = async () => {
    if (await confirmAction(t.disconnectTitle, t.disconnectMessage, t.disconnect)) {
      await run(() => messengerSyncService.disconnect());
      setReport(null);
    }
  };

  return (
    <Drawer title={t.title} icon="chatbubbles-outline" summary={summary}>
      <ErrorBanner message={error} />

      {!state.connected ? (
        <View style={styles.block}>
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
        <View style={styles.block}>
          {state.shop !== null ? (
            <>
              <Text style={styles.shopName}>{t.shopName(state.shop.name)}</Text>
              {state.shop.active ? (
                <Text style={styles.muted}>{t.subscriptionUntil(formatDisplayDate(state.shop.expiresAt))}</Text>
              ) : (
                <Text style={styles.errorText}>{t.subscriptionEnded}</Text>
              )}
              {state.shop.pageLinked ? (
                <Text style={styles.page}>{t.pageLinkedTo(state.shop.pageName ?? '')}</Text>
              ) : (
                <Text style={styles.warning}>{t.noPage}</Text>
              )}
              {state.shop.facebookLogin && state.shop.active ? (
                <AppButton
                  label={state.shop.pageLinked ? t.changePage : t.connectFacebook}
                  variant={state.shop.pageLinked ? 'secondary' : 'primary'}
                  onPress={() => void connectFacebook()}
                  loading={busy}
                />
              ) : null}
            </>
          ) : null}
          <Text style={styles.muted}>
            {state.syncing
              ? t.syncing
              : state.lastSyncAt === null
                ? t.neverSynced
                : t.lastSync(formatDisplayDateTime(state.lastSyncAt))}
          </Text>
          {state.lastError !== null ? <Text style={styles.errorText}>{t.lastError(state.lastError)}</Text> : null}
          {report !== null ? <Text style={styles.report}>{report}</Text> : null}
          <View style={styles.spacer} />
          <ToggleRow
            label={t.autoReply}
            value={state.autoReply}
            onChange={(value) => void run(() => messengerSyncService.setAutoReply(value))}
          />
          <ToggleRow
            label={t.notifyCustomer}
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
          <AppButton
            label={t.saveDeliveryFee}
            variant="secondary"
            onPress={() => void saveDeliveryFee()}
            loading={busy}
            disabled={deliveryFee === String(state.deliveryFee)}
          />
          <View style={styles.actions}>
            <AppButton label={t.syncNow} onPress={() => void syncNow()} loading={busy || state.syncing} />
            <AppButton label={t.replyHistory} variant="secondary" onPress={() => router.push('/messenger-replies')} />
            <AppButton label={t.disconnect} variant="secondary" onPress={() => void disconnect()} disabled={busy} />
          </View>
        </View>
      )}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  shopName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  page: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  warning: { fontSize: fontSize.sm, fontWeight: '600', color: colors.warning },
  errorText: { fontSize: fontSize.sm, color: colors.danger },
  report: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  spacer: { height: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  toggleLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
