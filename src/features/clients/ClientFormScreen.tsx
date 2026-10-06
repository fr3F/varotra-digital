import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { Client } from '@/models';
import { customerService } from '@/services/customer.service';
import { AppButton } from '@/shared/components/AppButton';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { useForm } from '@/shared/hooks/useForm';
import { goBackOr } from '@/shared/utils/navigation';
import { formatDisplayDate } from '@/utils/date.utils';
import { clientToFormValues, EMPTY_CLIENT_FORM, parseClientForm } from './client-form';
import { clientsMessages } from './clients.messages';

interface ClientFormScreenProps {
  readonly clientId: string;
}

/** Correction d'une fiche client (les clients sont créés à partir de Messenger). */
export function ClientFormScreen({ clientId }: ClientFormScreenProps) {
  const t = useMessages(clientsMessages);
  const common = useMessages(commonMessages);
  const [client, setClient] = useState<Client | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { values, setField, reset } = useForm(EMPTY_CLIENT_FORM);
  const { busy, error, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    customerService
      .getById(clientId)
      .then((loaded) => {
        if (active) {
          setClient(loaded);
          reset(clientToFormValues(loaded));
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setLoadError(toErrorMessage(caught));
        }
      });
    return () => {
      active = false;
    };
  }, [clientId, reset]);

  const save = () =>
    run(async () => {
      const input = parseClientForm(values, client);
      await customerService.update(clientId, input);
      goBackOr({ pathname: '/clients/[id]', params: { id: clientId } });
    });

  if (client === null) {
    return loadError === null ? <LoadingView /> : <ErrorBanner message={loadError} />;
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <Stack.Screen options={{ title: t.editTitle }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <Text style={styles.meta}>{t.clientSince(formatDisplayDate(client.createdAt))}</Text>
        <FormField label={t.name} required value={values.name} onChangeText={(v) => setField('name', v)} />
        <FormField
          label={t.phone}
          keyboardType="phone-pad"
          value={values.phone}
          onChangeText={(v) => setField('phone', v)}
          placeholder="034 12 345 67"
          hint={t.phoneHint}
        />
        <FormField
          label={t.address}
          value={values.address}
          onChangeText={(v) => setField('address', v)}
          placeholder={t.addressPlaceholder}
        />
        <FormField label={t.notes} multiline value={values.notes} onChangeText={(v) => setField('notes', v)} />
        <AppButton label={common.actions.save} onPress={() => void save()} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  meta: { marginBottom: spacing.lg, color: colors.textMuted, fontSize: fontSize.sm },
});
