import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_MESSENGER_BACKEND_URL } from '@/core/constants/app.constants';
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
      />
    </View>
  );
}

/** Liaison avec le serveur Messenger : connexion par code, état de la synchro, réglages. */
export function MessengerSettingsSection() {
  const state = useStore(messengerStore);
  const [url, setUrl] = useState(DEFAULT_MESSENGER_BACKEND_URL);
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('Téléphone du vendeur');
  const [report, setReport] = useState<string | null>(null);
  const { busy, error, run } = useAsyncAction();

  const describe = (imported: number, sent: number) =>
    `Synchronisé : ${imported} nouvelle(s) commande(s), ${sent} client(s) prévenu(s).`;

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

  const disconnect = async () => {
    if (await confirmAction('Déconnecter Messenger', 'Les nouvelles commandes Facebook ne seront plus récupérées.', 'Déconnecter')) {
      await run(() => messengerSyncService.disconnect());
      setReport(null);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Commandes Facebook Messenger</Text>
      <ErrorBanner message={error} />

      {!state.connected ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Reliez l’application au serveur Carnet Digital qui reçoit les messages de votre Page Facebook. L’application
            ne contacte jamais Facebook directement.
          </Text>
          <View style={styles.spacer} />
          <FormField
            label="Adresse du serveur"
            value={url}
            onChangeText={setUrl}
            placeholder="https://mon-serveur.com"
            keyboardType="url"
          />
          <FormField label="Code d’appairage" value={code} onChangeText={setCode} placeholder="Défini sur le serveur" />
          <FormField label="Nom de cet appareil" value={deviceName} onChangeText={setDeviceName} />
          <AppButton label="Connecter" onPress={() => void connect()} loading={busy} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.connected}>Connecté à {state.backendUrl}</Text>
          <Text style={styles.muted}>
            {state.syncing
              ? 'Synchronisation en cours…'
              : state.lastSyncAt === null
                ? 'Jamais synchronisé'
                : `Dernière synchronisation : ${formatDisplayDateTime(state.lastSyncAt)}`}
          </Text>
          <Text style={styles.muted}>
            {state.pushActive
              ? 'Notifications push actives : chaque commande Messenger est signalée, même application fermée.'
              : 'Notifications push inactives (APK et notifications « Nouvelle commande » requis) : vérification toutes les 15 s, application ouverte.'}
          </Text>
          {state.lastError !== null ? <Text style={styles.errorText}>Dernière erreur : {state.lastError}</Text> : null}
          {report !== null ? <Text style={styles.report}>{report}</Text> : null}
          <View style={styles.spacer} />
          <ToggleRow
            label="Réponse automatique"
            description="Stock disponible : commande validée et « Votre commande est confirmée. ». Stock insuffisant : « Produit indisponible actuellement. ». Messages incompris : vous décidez."
            value={state.autoReply}
            onChange={(value) => void run(() => messengerSyncService.setAutoReply(value))}
          />
          <ToggleRow
            label="Prévenir le client"
            description="Message Messenger quand vous confirmez, livrez ou annulez une commande (dans les 24 h suivant son dernier message)."
            value={state.notifyCustomer}
            onChange={(value) => void run(() => messengerSyncService.setNotifyCustomer(value))}
          />
          <View style={styles.actions}>
            <AppButton label="Synchroniser maintenant" onPress={() => void syncNow()} loading={busy || state.syncing} />
            <AppButton
              label="Historique des réponses"
              variant="secondary"
              onPress={() => router.push('/messenger-replies')}
            />
            <AppButton label="Déconnecter" variant="secondary" onPress={() => void disconnect()} disabled={busy} />
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
