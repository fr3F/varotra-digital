import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { formatDisplayDate } from '@/utils/date.utils';
import { Product } from '@/models';
import { productService } from '@/services/product.service';
import { AppButton } from '@/shared/components/AppButton';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { useForm } from '@/shared/hooks/useForm';
import { confirmAction } from '@/shared/utils/confirm';
import { goBackOr } from '@/shared/utils/navigation';
import { EMPTY_PRODUCT_FORM, parseProductForm, productToFormValues } from './product-form';
import { ProductImagePicker } from './ProductImagePicker';
import { ProductStockCard } from './ProductStockCard';

interface ProductFormScreenProps {
  /** null = création d'un nouveau produit. */
  readonly productId: string | null;
}

export function ProductFormScreen({ productId }: ProductFormScreenProps) {
  const isNew = productId === null;
  const [product, setProduct] = useState<Product | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { values, setField, reset } = useForm(EMPTY_PRODUCT_FORM);
  const { busy, error, run } = useAsyncAction();

  useEffect(() => {
    if (productId === null) {
      return;
    }
    let active = true;
    productService
      .getById(productId)
      .then((loaded) => {
        if (active) {
          setProduct(loaded);
          reset(productToFormValues(loaded));
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
  }, [productId, reset]);

  const save = () =>
    run(async () => {
      const { input, initialStock } = parseProductForm(values);
      if (productId === null) {
        await productService.create(input, initialStock);
      } else {
        await productService.update(productId, input);
      }
      goBackOr('/products');
    });

  const remove = async () => {
    if (productId === null || !(await confirmAction('Supprimer', 'Supprimer ce produit ?', 'Supprimer'))) {
      return;
    }
    await run(async () => {
      await productService.remove(productId);
      goBackOr('/products');
    });
  };

  if (!isNew && product === null) {
    return loadError === null ? <LoadingView /> : <ErrorBanner message={loadError} />;
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height">
      <Stack.Screen options={{ title: isNew ? 'Nouveau produit' : 'Modifier le produit' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />
        {product !== null ? (
          <Text style={styles.meta}>
            Créé le {formatDisplayDate(product.createdAt)}
            {formatDisplayDate(product.updatedAt) !== formatDisplayDate(product.createdAt)
              ? ` · modifié le ${formatDisplayDate(product.updatedAt)}`
              : ''}
          </Text>
        ) : null}
        <ProductImagePicker
          productName={values.name}
          imageUri={values.imageUri}
          onChange={(uri) => setField('imageUri', uri)}
          disabled={busy}
        />
        <FormField label="Nom" required value={values.name} onChangeText={(v) => setField('name', v)} />
        <FormField label="Référence (SKU)" value={values.sku} onChangeText={(v) => setField('sku', v)} />
        <FormField label="Catégorie" value={values.category} onChangeText={(v) => setField('category', v)} />
        <FormField
          label="Prix de vente (Ar)"
          required
          keyboardType="number-pad"
          value={values.unitPrice}
          onChangeText={(v) => setField('unitPrice', v)}
        />
        <FormField
          label="Prix d'achat (Ar)"
          keyboardType="number-pad"
          value={values.costPrice}
          onChangeText={(v) => setField('costPrice', v)}
        />
        <FormField
          label="Seuil d'alerte stock"
          keyboardType="number-pad"
          value={values.alertThreshold}
          onChangeText={(v) => setField('alertThreshold', v)}
          hint="Le produit est signalé lorsque son stock atteint ce seuil."
        />
        {isNew ? (
          <FormField
            label="Stock initial"
            keyboardType="number-pad"
            value={values.initialStock}
            onChangeText={(v) => setField('initialStock', v)}
          />
        ) : null}
        <FormField
          label="Description"
          multiline
          value={values.description}
          onChangeText={(v) => setField('description', v)}
        />

        <View style={styles.actions}>
          <AppButton label="Enregistrer" onPress={() => void save()} loading={busy} />
          {!isNew ? <AppButton label="Supprimer" variant="danger" onPress={() => void remove()} disabled={busy} /> : null}
        </View>

        {product !== null ? <ProductStockCard productId={product.id} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  actions: { gap: spacing.md },
  meta: { marginBottom: spacing.lg, color: colors.textMuted, fontSize: fontSize.sm },
});
