import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { useMessages } from '@/core/i18n/i18n';
import { useStore } from '@/core/state/store';
import { Order } from '@/models';
import { messengerOutboxVersion, messengerStore } from '@/services/messenger/messenger-state';
import { facebookReplyService } from '@/services/messenger/facebook-reply.service';
import { AppButton } from '@/shared/components/AppButton';
import { Drawer } from '@/shared/components/Drawer';
import { FormField } from '@/shared/components/FormField';
import { ErrorBanner } from '@/shared/components/StatusViews';
import { useAsyncAction } from '@/shared/hooks/useAsyncAction';
import { useQuery } from '@/shared/hooks/useQuery';
import { ReplyRow } from '../messenger/ReplyRow';
import { ordersMessages } from './orders.messages';

/** Commande Messenger (tiroir fermé) : message du client, écrire au client, messages envoyés. */
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
    <Drawer title={t.messengerTitle} icon="chatbubbles-outline" summary={order.customerMessage}>
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
    </Drawer>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted, marginTop: spacing.xs },
  quote: { fontSize: fontSize.md, fontStyle: 'italic', color: colors.text },
});
