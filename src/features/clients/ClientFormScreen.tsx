import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
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

interface ClientFormScreenProps {
  /** null = création d'un nouveau client. */
  readonly clientId: string | null;
}

export function ClientFormScreen({ clientId }: ClientFormScreenProps) {
  const isNew = clientId === null;
  const [client, setClient] = useState<Client | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { values, setField, reset } = useForm(EMPTY_CLIENT_FORM);
  const { busy, error, run } = useAsyncAction();

  useEffect(() => {
    if (clientId === null) {
      return;
    }
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
      if (clientId === null) {
        const created = await customerService.create(input);
        // Depuis une commande, on revient sur la commande ; sinon on ouvre la fiche créée.
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace({ pathname: '/clients/[id]', params: { id: created.id } });
        }
      } else {
        await customerService.update(clientId, input);
        goBackOr({ pathname: '/clients/[id]', params: { id: clientId } });
      }
    });

  if (!isNew && client === null) {
    return loadError === null ? <LoadingView /> : <ErrorBanner message={loadError} />;
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <Stack.Screen options={{ title: isNew ? 'Nouveau client' : 'Modifier le client' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        {client !== null ? <Text style={styles.meta}>Client depuis le {formatDisplayDate(client.createdAt)}</Text> : null}
        <FormField label="Nom" required value={values.name} onChangeText={(v) => setField('name', v)} />
        <FormField
          label="Téléphone"
          keyboardType="phone-pad"
          value={values.phone}
          onChangeText={(v) => setField('phone', v)}
          placeholder="034 12 345 67"
          hint="Un même numéro ne peut pas être attribué à deux clients."
        />
        <FormField
          label="Adresse"
          value={values.address}
          onChangeText={(v) => setField('address', v)}
          placeholder="Quartier, ville, repère…"
        />
        <FormField label="Notes" multiline value={values.notes} onChangeText={(v) => setField('notes', v)} />
        <AppButton label={isNew ? 'Ajouter le client' : 'Enregistrer'} onPress={() => void save()} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  meta: { marginBottom: spacing.lg, color: colors.textMuted, fontSize: fontSize.sm },
});
