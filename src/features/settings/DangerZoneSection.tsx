import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { resetService } from '@/services/reset.service';
import { AppButton } from '@/shared/components/AppButton';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { confirmAction } from '@/shared/utils/confirm';

/** Réglages › Zone de danger : suppression de toutes les données, avec double confirmation. */
export function DangerZoneSection() {
  const { busy, error, run } = useAsyncAction();
  const [message, setMessage] = useState<string | null>(null);

  const deleteAll = async () => {
    setMessage(null);
    const summary = await resetService.summary();
    const details = [
      `${summary.products} produit(s)`,
      `${summary.orders} commande(s)`,
      `${summary.sales} vente(s)`,
      `${summary.clients} client(s)`,
      `${summary.expenses} dépense(s)`,
    ].join(', ');
    const first = await confirmAction(
      'Supprimer toutes les données ?',
      `Seront supprimés : ${details}, ainsi que le stock, l’historique et les photos des produits.`,
      'Continuer',
    );
    if (!first) {
      return;
    }
    const second = await confirmAction(
      'Dernière confirmation',
      'Cette action est définitive : les données ne pourront pas être récupérées.',
      'Tout supprimer',
    );
    if (!second) {
      return;
    }
    const done = await run(() => resetService.deleteAllData());
    if (done) {
      setMessage('Toutes les données ont été supprimées.');
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Zone de danger</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Supprimer toutes les données</Text>
        <Text style={styles.muted}>
          Produits, stock, commandes, ventes, dépenses, clients et photos. Les réglages et la liaison Messenger sont
          conservés.
        </Text>
        <ErrorBanner message={error} />
        {message !== null ? <Text style={styles.done}>{message}</Text> : null}
        <View style={styles.spaced}>
          <AppButton label="Supprimer toutes les données" variant="danger" onPress={() => void deleteAll()} loading={busy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.danger },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
    gap: spacing.xs,
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  done: { fontSize: fontSize.sm, fontWeight: '600', color: colors.success },
  spaced: { marginTop: spacing.md },
});
