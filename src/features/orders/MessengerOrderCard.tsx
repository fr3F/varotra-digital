import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { Order } from '@/models';
import { messengerOutboxVersion, messengerStore } from '@/services/messenger/messenger-state';
import { facebookReplyService } from '@/services/messenger/facebook-reply.service';
import { useQuery } from '@/shared/hooks/useQuery';
import { ReplyRow } from '../messenger/ReplyRow';
import { MessengerBadges } from './MessengerBadges';

/** Commande reçue via Messenger : message du client, contrôle du stock, suivi des messages envoyés. */
export function MessengerOrderCard({ order }: { readonly order: Order }) {
  const version = useStore(messengerOutboxVersion) + useStore(messengerStore).syncCount;
  const fetchReplies = useCallback(() => facebookReplyService.history(order.id), [order.id]);
  const { data: replies } = useQuery(fetchReplies, version);

  if (order.source !== 'MESSENGER') {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Commande reçue via Messenger</Text>
      <MessengerBadges order={order} />
      {order.needsReview ? (
        <Text style={styles.warning}>
          À vérifier : complétez ou corrigez les produits avec « Modifier la commande », puis validez-la.
        </Text>
      ) : null}
      {order.stockCheck === 'SHORTAGE' ? (
        <Text style={styles.warning}>Stock insuffisant pour au moins un produit : la validation sera refusée.</Text>
      ) : null}
      {order.customerMessage !== null ? (
        <>
          <Text style={styles.label}>Message du client</Text>
          <Text style={styles.quote}>« {order.customerMessage} »</Text>
        </>
      ) : null}
      {replies !== null && replies.length > 0 ? (
        <>
          <Text style={styles.label}>Réponses Facebook</Text>
          {replies.map((reply) => (
            <ReplyRow key={reply.id} reply={reply} />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.info,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs },
  quote: { fontSize: fontSize.md, fontStyle: 'italic', color: colors.text },
  warning: { fontSize: fontSize.sm, fontWeight: '600', color: colors.warning },
});
