import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useMessages } from '@/core/i18n/i18n';
import { useStore } from '@/core/state/store';
import { Order } from '@/models';
import { messengerOutboxVersion, messengerStore } from '@/services/messenger/messenger-state';
import { facebookReplyService } from '@/services/messenger/facebook-reply.service';
import { AppButton } from '@/shared/components/AppButton';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { useQuery } from '@/shared/hooks/useQuery';
import { ReplyRow } from '../messenger/ReplyRow';
import { MessengerBadges } from './MessengerBadges';
import { ordersMessages } from './orders.messages';

/** Commande reçue via Messenger : message du client, contrôle du stock, suivi des messages envoyés. */
export function MessengerOrderCard({ order }: { readonly order: Order }) {
  const t = useMessages(ordersMessages);
  const version = useStore(messengerOutboxVersion) + useStore(messengerStore).syncCount;
  const fetchReplies = useCallback(() => facebookReplyService.history(order.id), [order.id]);
  const { data: replies } = useQuery(fetchReplies, version);
  const [message, setMessage] = useState('');
  const { busy, error, run } = useAsyncAction();

  const send = () =>
    run(async () => {
      await facebookReplyService.sendMessage(order, message);
      setMessage('');
    });

  if (order.source !== 'MESSENGER') {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t.messengerTitle}</Text>
      <MessengerBadges order={order} />
      {order.needsReview ? (
        <Text style={styles.warning}>{t.messengerReview}</Text>
      ) : null}
      {order.stockCheck === 'SHORTAGE' ? (
        <Text style={styles.warning}>{t.messengerShortage}</Text>
      ) : null}
      {order.customerMessage !== null ? (
        <>
          <Text style={styles.label}>{t.customerMessage}</Text>
          <Text style={styles.quote}>« {order.customerMessage} »</Text>
        </>
      ) : null}
      <ErrorBanner message={error} />
      <FormField
        label={t.writeToCustomer}
        value={message}
        onChangeText={setMessage}
        placeholder={t.messagePlaceholder}
        hint={t.writeToCustomerHint}
        multiline
      />
      <AppButton
        label={t.sendMessage}
        onPress={() => void send()}
        loading={busy}
        disabled={message.trim().length === 0}
      />
      {replies !== null && replies.length > 0 ? (
        <>
          <Text style={styles.label}>{t.facebookReplies}</Text>
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
