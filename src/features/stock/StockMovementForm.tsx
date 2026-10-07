import { useMemo, useState } from 'react';
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
import { useMessages } from '@/core/i18n/i18n';
import { stockMessages } from './stock.messages';

type FormMode = 'ENTRY' | 'EXIT' | 'COUNT';

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
  const t = useMessages(stockMessages);
  const modeOptions = useMemo<readonly ChipOption<FormMode>[]>(
    () => [
      { value: 'ENTRY', label: t.modeEntry },
      { value: 'EXIT', label: t.modeExit },
      { value: 'COUNT', label: t.modeCount },
    ],
    [t],
  );
  const modeTexts: Readonly<Record<FormMode, { field: string; submit: string; placeholder: string }>> = {
    ENTRY: { field: t.fieldEntry, submit: t.submitEntry, placeholder: t.placeholderEntry },
    EXIT: { field: t.fieldExit, submit: t.submitExit, placeholder: t.placeholderExit },
    COUNT: { field: t.fieldCount, submit: t.submitCount, placeholder: t.placeholderCount },
  };
  const [mode, setMode] = useState<FormMode>('ENTRY');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const { busy, error, run, clearError } = useAsyncAction();

  const texts = modeTexts[mode];
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
            throw new ValidationError(t.required(texts.field));
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
      <ChipGroup accessibilityLabel={t.movementType} options={modeOptions} selected={mode} onSelect={changeMode} />
      <View style={styles.spacer} />
      <ErrorBanner message={error} />
      <FormField
        label={texts.field}
        required
        keyboardType="number-pad"
        value={quantity}
        onChangeText={setQuantity}
      />
      <FormField label={t.reason} value={reason} onChangeText={setReason} placeholder={texts.placeholder} />
      {preview !== null ? (
        <Text style={[styles.preview, invalidPreview && styles.previewInvalid]}>
          {invalidPreview
            ? product.reservedQuantity > 0
              ? t.insufficientReserved(available, product.reservedQuantity)
              : t.insufficient(available)
            : t.previewChange(product.stockQuantity, preview)}
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
