import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ValidationError } from '@/core/errors/app-error';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { availableQuantity, Product } from '@/models';
import { MovementResult } from '@/services/stock-movement.service';
import { stockService } from '@/services/stock.service';
import { AppButton } from '@/shared/components/AppButton';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { optionalText, parseNonNegativeInteger, parsePositiveInteger } from '@/utils/validation.utils';

type FormMode = 'ENTRY' | 'EXIT' | 'COUNT';

const MODE_OPTIONS: readonly ChipOption<FormMode>[] = [
  { value: 'ENTRY', label: 'Entrée' },
  { value: 'EXIT', label: 'Sortie' },
  { value: 'COUNT', label: 'Ajuster la quantité' },
];

const MODE_TEXTS: Readonly<Record<FormMode, { field: string; submit: string; placeholder: string }>> = {
  ENTRY: { field: 'Quantité à ajouter', submit: "Enregistrer l'entrée", placeholder: 'Réapprovisionnement, achat…' },
  EXIT: { field: 'Quantité à retirer', submit: 'Enregistrer la sortie', placeholder: 'Casse, perte, cadeau…' },
  COUNT: { field: 'Quantité réelle comptée', submit: 'Corriger le stock', placeholder: 'Inventaire' },
};

/** Calcule la quantité après mouvement pour l'aperçu, ou null si la saisie est incomplète. */
function previewQuantity(mode: FormMode, current: number, text: string): number | null {
  if (!/^\d+$/.test(text.trim())) {
    return null;
  }
  const value = Number(text.trim());
  switch (mode) {
    case 'ENTRY':
      return current + value;
    case 'EXIT':
      return current - value;
    case 'COUNT':
      return value;
  }
}

interface StockMovementFormProps {
  readonly product: Product;
  readonly onRecorded?: (product: Product) => void;
}

export function StockMovementForm({ product, onRecorded }: StockMovementFormProps) {
  const [mode, setMode] = useState<FormMode>('ENTRY');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const { busy, error, run, clearError } = useAsyncAction();

  const texts = MODE_TEXTS[mode];
  const preview = previewQuantity(mode, product.stockQuantity, quantity);
  // Le stock ne peut pas descendre sous les unités réservées par des commandes confirmées.
  const invalidPreview = preview !== null && preview < product.reservedQuantity;
  const available = availableQuantity(product);

  const changeMode = (next: FormMode) => {
    setMode(next);
    clearError();
  };

  const submit = () =>
    run(async () => {
      const note = optionalText(reason);
      let result: MovementResult;
      switch (mode) {
        case 'ENTRY':
          result = await stockService.addEntry(product.id, parsePositiveInteger(quantity, texts.field), note);
          break;
        case 'EXIT':
          result = await stockService.removeExit(product.id, parsePositiveInteger(quantity, texts.field), note);
          break;
        case 'COUNT': {
          if (quantity.trim().length === 0) {
            throw new ValidationError(`Le champ « ${texts.field} » est obligatoire.`);
          }
          result = await stockService.setQuantity(product.id, parseNonNegativeInteger(quantity, texts.field), note);
          break;
        }
      }
      setQuantity('');
      setReason('');
      onRecorded?.(result.product);
    });

  return (
    <View style={styles.card}>
      <ChipGroup accessibilityLabel="Type de mouvement" options={MODE_OPTIONS} selected={mode} onSelect={changeMode} />
      <View style={styles.spacer} />
      <ErrorBanner message={error} />
      <FormField
        label={texts.field}
        required
        keyboardType="number-pad"
        value={quantity}
        onChangeText={setQuantity}
      />
      <FormField label="Motif" value={reason} onChangeText={setReason} placeholder={texts.placeholder} />
      {preview !== null ? (
        <Text style={[styles.preview, invalidPreview && styles.previewInvalid]}>
          {invalidPreview
            ? product.reservedQuantity > 0
              ? `Stock insuffisant : ${available} disponible(s), ${product.reservedQuantity} réservé(s) pour des commandes.`
              : `Stock insuffisant : seulement ${available} disponible(s).`
            : `Stock : ${product.stockQuantity} → ${preview}`}
        </Text>
      ) : null}
      <AppButton
        label={texts.submit}
        variant={mode === 'EXIT' ? 'danger' : 'primary'}
        onPress={() => void submit()}
        loading={busy}
        disabled={invalidPreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  spacer: { height: spacing.md },
  preview: { marginBottom: spacing.md, fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  previewInvalid: { color: colors.danger },
});
