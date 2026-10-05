import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { marginRate, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PaymentMethod } from '@/models';
import { saleService } from '@/services/sale.service';
import { AppButton } from '@/shared/components/AppButton';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { ClientPicker } from '@/shared/components/ClientPicker';
import { FormField } from '@/shared/components/FormField';
import { ProductLinesEditor } from '@/shared/components/ProductLinesEditor';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { previewLinesCost, previewLinesTotal } from '@/shared/forms/product-lines-form';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { formatMoney } from '@/utils/money.utils';
import { useClients } from '../clients/useClients';
import { useProducts } from '../products/useProducts';
import { EMPTY_SALE_FORM, parseSaleForm, SaleFormState } from './sale-form';

const PAYMENT_OPTIONS: readonly ChipOption<PaymentMethod>[] = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

function TotalRow({ label, value, emphasis = false, tone }: { label: string; value: string; emphasis?: boolean; tone?: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, emphasis && styles.totalLabelStrong]}>{label}</Text>
      <Text style={[styles.totalValue, emphasis && styles.totalValueStrong, tone !== undefined && { color: tone }]}>
        {value}
      </Text>
    </View>
  );
}

/** Vente au comptoir : le stock est vérifié et déduit à l'enregistrement. */
export function SaleFormScreen() {
  const [form, setForm] = useState<SaleFormState>(EMPTY_SALE_FORM);
  const { busy, error, run } = useAsyncAction();
  const { products } = useProducts({ search: '', category: null });
  const { clients } = useClients();

  const total = previewLinesTotal(form.lines);
  const cost = previewLinesCost(form.lines, products);
  const profit = total - cost;
  const rate = marginRate(total, profit);

  const save = () =>
    run(async () => {
      const draft = parseSaleForm(form, (productId) => products.find((p) => p.id === productId)?.name ?? 'produit');
      const sale = await saleService.create(draft);
      router.replace({ pathname: '/sales/[id]', params: { id: sale.id } });
    });

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <Stack.Screen options={{ title: 'Nouvelle vente' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        <ProductLinesEditor
          lines={form.lines}
          products={products}
          onChange={(lines) => setForm((previous) => ({ ...previous, lines }))}
          disabled={busy}
          stockMode="strict"
          showMargin
        />
        <ClientPicker
          clients={clients}
          selectedId={form.clientId}
          onChange={(clientId) => setForm((previous) => ({ ...previous, clientId }))}
          disabled={busy}
          emptyLabel="Client de passage"
        />
        <Text style={styles.label}>Paiement</Text>
        <ChipGroup
          accessibilityLabel="Mode de paiement"
          options={PAYMENT_OPTIONS}
          selected={form.paymentMethod}
          onSelect={(paymentMethod) => setForm((previous) => ({ ...previous, paymentMethod }))}
        />
        <View style={styles.spacer} />
        <FormField
          label="Notes"
          value={form.notes}
          onChangeText={(notes) => setForm((previous) => ({ ...previous, notes }))}
          placeholder="Remarque, remise accordée…"
        />

        <View style={styles.totals}>
          <TotalRow label="Prix d’achat des produits" value={formatMoney(cost)} />
          <TotalRow
            label={`Bénéfice${rate === null ? '' : ` (${rate.toFixed(0)} %)`}`}
            value={formatMoney(profit)}
            tone={profit < 0 ? colors.danger : colors.success}
          />
          <TotalRow label="Total à encaisser" value={formatMoney(total)} emphasis />
        </View>

        <AppButton label="Enregistrer la vente" onPress={() => void save()} loading={busy} />
        <Text style={styles.hint}>Le stock de chaque produit est déduit et la sortie tracée dans l’historique du stock.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  spacer: { height: spacing.lg },
  totals: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: fontSize.md, color: colors.textMuted },
  totalLabelStrong: { color: colors.text, fontWeight: '700' },
  totalValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  totalValueStrong: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primaryDark },
  hint: { marginTop: spacing.md, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
});
