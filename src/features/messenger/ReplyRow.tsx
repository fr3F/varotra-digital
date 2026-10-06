import { StyleSheet, Text, View } from 'react-native';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { CustomerReply } from '@/models';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { messengerMessages } from './messenger.messages';

interface ReplyRowProps {
  readonly reply: CustomerReply;
  /** Titre affiché au-dessus (historique global : référence et client). */
  readonly heading?: string;
}

/** Une réponse Facebook : type, origine (auto / vendeur), texte envoyé, résultat. */
export function ReplyRow({ reply, heading }: ReplyRowProps) {
  const t = useMessages(messengerMessages);
  const { customerReply, customerReplyResult } = useMessages(commonMessages);
  const pending = reply.result === null;
  const delivered = reply.result === 'DELIVERED';
  return (
    <View style={styles.row}>
      {heading !== undefined ? <Text style={styles.heading}>{heading}</Text> : null}
      <View style={styles.top}>
        <Text style={styles.kind}>{customerReply[reply.kind]}</Text>
        <View style={[styles.origin, reply.automatic ? styles.auto : styles.manual]}>
          <Text style={[styles.originText, reply.automatic ? styles.autoText : styles.manualText]}>
            {reply.automatic ? t.originAuto : t.originSeller}
          </Text>
        </View>
        <Text style={styles.date}>{formatDisplayDateTime(reply.createdAt)}</Text>
      </View>
      {reply.messageText !== null ? <Text style={styles.message}>{reply.messageText}</Text> : null}
      <Text style={[styles.result, delivered && styles.ok, !pending && !delivered && styles.ko]}>
        {pending ? t.waitingNetwork : customerReplyResult[reply.result ?? 'SEND_FAILED']}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.sm },
  heading: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  kind: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  origin: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.pill },
  auto: { backgroundColor: colors.infoLight },
  manual: { backgroundColor: colors.border },
  originText: { fontSize: 12, fontWeight: '700' },
  autoText: { color: colors.info },
  manualText: { color: colors.textMuted },
  date: { fontSize: fontSize.sm, color: colors.textMuted },
  message: {
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  result: { fontSize: fontSize.sm, color: colors.textMuted },
  ok: { color: colors.success, fontWeight: '600' },
  ko: { color: colors.danger, fontWeight: '600' },
});
