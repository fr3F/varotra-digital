import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { availableQuantity, EntityId, Product } from '@/models';
import { addProductLine, parseQuantity, previewLineTotal, ProductLineFormValue } from '@/shared/forms/product-lines-form';
import { formatMoney } from '@/utils/money.utils';
import { AppButton } from './AppButton';
import { SelectionModal } from './SelectionModal';
import { Thumbnail } from './Thumbnail';

interface ProductLinesEditorProps {
  readonly lines: readonly ProductLineFormValue[];
  readonly products: readonly Product[];
  readonly onChange: (lines: ProductLineFormValue[]) => void;
  readonly disabled?: boolean;
  /**
   * warn : commande (le stock n'est vérifié qu'à la validation) ;
   * strict : vente immédiate, un stock insuffisant bloquera l'enregistrement.
   */
  readonly stockMode?: 'warn' | 'strict';
  /** Affiche la marge de chaque ligne (prix de vente - prix d'achat). */
  readonly showMargin?: boolean;
}

function Stepper({
  label,
  value,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
}) {
  const current = parseQuantity(value) ?? 0;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Diminuer ${label}`}
        disabled={disabled || current <= 1}
        onPress={() => onChange(String(current - 1))}
        style={[styles.stepButton, (disabled || current <= 1) && styles.stepDisabled]}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        editable={!disabled}
        style={styles.stepInput}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Augmenter ${label}`}
        disabled={disabled}
        onPress={() => onChange(String(current + 1))}
        style={[styles.stepButton, disabled && styles.stepDisabled]}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

/** Saisie des lignes (commandes, ventes) : produit, quantité, prix unitaire, montant. */
export function ProductLinesEditor({
  lines,
  products,
  onChange,
  disabled = false,
  stockMode = 'warn',
  showMargin = false,
}: ProductLinesEditorProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const updateLine = (productId: EntityId, patch: Partial<ProductLineFormValue>) =>
    onChange(lines.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Produits <Text style={styles.required}>*</Text>
      </Text>

      {lines.map((line) => {
        const product = productsById.get(line.productId);
        const name = product?.name ?? 'Produit supprimé';
        const quantity = parseQuantity(line.quantity);
        const available = product === undefined ? 0 : availableQuantity(product);
        const lineTotal = previewLineTotal(line);
        const shortage = quantity !== null && quantity > available;
        const margin =
          showMargin && lineTotal !== null && quantity !== null && product !== undefined
            ? lineTotal - quantity * product.costPrice
            : null;
        return (
          <View key={line.productId} style={styles.line}>
            <View style={styles.lineHeader}>
              <Thumbnail name={name} imageUri={product?.imageUri ?? null} size={40} />
              <View style={styles.lineTitle}>
                <Text style={styles.productName} numberOfLines={1}>
                  {name}
                </Text>
                <Text
                  style={[
                    styles.available,
                    shortage && (stockMode === 'strict' ? styles.availableError : styles.availableWarning),
                  ]}
                >
                  {shortage ? `Stock disponible insuffisant : ${available}` : `Disponible : ${available}`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${name}`}
                disabled={disabled}
                hitSlop={8}
                onPress={() => onChange(lines.filter((candidate) => candidate.productId !== line.productId))}
              >
                <Text style={styles.remove}>Retirer</Text>
              </Pressable>
            </View>
            <View style={styles.lineFields}>
              <Stepper
                label={`Quantité de ${name}`}
                value={line.quantity}
                onChange={(value) => updateLine(line.productId, { quantity: value })}
                disabled={disabled}
              />
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>Prix unitaire (Ar)</Text>
                <TextInput
                  accessibilityLabel={`Prix de ${name}`}
                  value={line.unitPrice}
                  onChangeText={(value) => updateLine(line.productId, { unitPrice: value })}
                  keyboardType="number-pad"
                  editable={!disabled}
                  style={styles.priceInput}
                />
              </View>
            </View>
            <View style={styles.lineFooter}>
              {margin !== null ? (
                <Text style={[styles.margin, margin < 0 && styles.marginNegative]}>Marge : {formatMoney(margin)}</Text>
              ) : (
                <View />
              )}
              <Text style={styles.lineTotal}>{lineTotal === null ? '—' : formatMoney(lineTotal)}</Text>
            </View>
          </View>
        );
      })}

      <AppButton
        label="+ Ajouter un produit"
        variant="secondary"
        onPress={() => setPickerVisible(true)}
        disabled={disabled}
      />

      <SelectionModal
        visible={pickerVisible}
        title="Choisir un produit"
        items={products}
        keyOf={(product) => product.id}
        searchTextOf={(product) => `${product.name} ${product.sku ?? ''} ${product.category ?? ''}`}
        emptyMessage="Aucun produit : créez-en un dans le module Produits."
        onClose={() => setPickerVisible(false)}
        onSelect={(product) => {
          onChange(addProductLine(lines, product));
          setPickerVisible(false);
        }}
        renderItem={(product) => (
          <View style={styles.option}>
            <Thumbnail name={product.name} imageUri={product.imageUri} size={40} />
            <View style={styles.lineTitle}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.available}>
                {formatMoney(product.unitPrice)} · disponible : {availableQuantity(product)}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg, gap: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  required: { color: colors.danger },
  line: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineTitle: { flex: 1 },
  productName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  available: { fontSize: fontSize.sm, color: colors.textMuted },
  availableWarning: { color: colors.warning, fontWeight: '600' },
  availableError: { color: colors.danger, fontWeight: '600' },
  lineFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  margin: { fontSize: fontSize.sm, color: colors.success, fontWeight: '600' },
  marginNegative: { color: colors.danger },
  remove: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '600' },
  lineFields: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primaryDark },
  stepInput: {
    width: 56,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontSize: fontSize.md,
    color: colors.text,
  },
  priceBox: { flex: 1 },
  priceLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: 2 },
  priceInput: {
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  lineTotal: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
});
