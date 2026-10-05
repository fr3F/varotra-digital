import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { isOrderEditable, ORDER_STATUS_LABELS, OrderStatus } from '@/models';
import { orderService } from '@/services/order.service';
import { AppButton } from '@/shared/components/AppButton';
import { FormField } from '@/shared/components/FormField';
import { ClientPicker } from '@/shared/components/ClientPicker';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { goBackOr } from '@/shared/utils/navigation';
import { formatMoney } from '@/utils/money.utils';
import { useClients } from '../clients/useClients';
import { useProducts } from '../products/useProducts';
import { ProductLinesEditor } from '@/shared/components/ProductLinesEditor';
import { previewLinesTotal } from '@/shared/forms/product-lines-form';
import { EMPTY_ORDER_FORM, OrderFormState, orderDetailToForm, parseOrderForm } from './order-form';

interface OrderFormScreenProps {
  /** null = nouvelle commande. */
  readonly orderId: string | null;
  /** Client présélectionné pour une nouvelle commande (ouverte depuis sa fiche). */
  readonly initialClientId?: string | null;
}

export function OrderFormScreen({ orderId, initialClientId = null }: OrderFormScreenProps) {
  const isNew = orderId === null;
  const [form, setForm] = useState<OrderFormState>({ ...EMPTY_ORDER_FORM, clientId: initialClientId });
  const [loadedStatus, setLoadedStatus] = useState<OrderStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAsyncAction();
  const { products } = useProducts({ search: '', category: null });
  const { clients } = useClients();

  useEffect(() => {
    if (orderId === null) {
      return;
    }
    let active = true;
    orderService
      .getDetail(orderId)
      .then((detail) => {
        if (active) {
          setForm(orderDetailToForm(detail));
          setLoadedStatus(detail.order.status);
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
  }, [orderId]);

  const total = previewLinesTotal(form.lines);

  const save = () =>
    run(async () => {
      const draft = parseOrderForm(form, (productId) => products.find((p) => p.id === productId)?.name ?? 'produit');
      if (orderId === null) {
        const created = await orderService.create(draft);
        router.replace({ pathname: '/orders/[id]', params: { id: created.id } });
      } else {
        await orderService.update(orderId, draft);
        goBackOr({ pathname: '/orders/[id]', params: { id: orderId } });
      }
    });

  if (!isNew && loadedStatus === null) {
    return loadError === null ? <LoadingView /> : <ErrorBanner message={loadError} />;
  }
  if (loadedStatus !== null && !isOrderEditable(loadedStatus)) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Modifier la commande' }} />
        <EmptyState
          title={`Commande « ${ORDER_STATUS_LABELS[loadedStatus]} »`}
          message="Elle ne peut plus être modifiée. Remettez-la en préparation depuis son détail pour changer ses produits."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <Stack.Screen options={{ title: isNew ? 'Nouvelle commande' : 'Modifier la commande' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />

        <ClientPicker
          clients={clients}
          selectedId={form.clientId}
          onChange={(clientId) => setForm((previous) => ({ ...previous, clientId }))}
          disabled={busy}
        />

        <ProductLinesEditor
          lines={form.lines}
          products={products}
          onChange={(lines) => setForm((previous) => ({ ...previous, lines }))}
          disabled={busy}
        />

        <FormField
          label="Notes"
          multiline
          value={form.notes}
          onChangeText={(notes) => setForm((previous) => ({ ...previous, notes }))}
          placeholder="Adresse de livraison, créneau, remarque…"
        />

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Montant total</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>

        <AppButton
          label={isNew ? 'Créer la commande' : 'Enregistrer les modifications'}
          onPress={() => void save()}
          loading={busy}
        />
        {isNew ? (
          <Text style={styles.hint}>
            La commande est créée au statut « Nouvelle ». Le stock est vérifié et réservé lors de sa validation.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  totalLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.primaryDark },
  totalValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primaryDark, fontVariant: ['tabular-nums'] },
  hint: { marginTop: spacing.md, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
});
