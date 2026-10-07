import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { commonMessages } from '@/core/i18n/common.messages';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, shadow, spacing } from '@/core/theme/theme';
import { Client, Order } from '@/models';
import { AppButton } from '@/shared/components/AppButton';
import { phoneDigits } from '@/utils/phone.utils';
import { ordersMessages } from './orders.messages';

/**
 * Qui livrer et où : nom (vers la fiche client), téléphone avec appel direct, adresse.
 * Téléphone et adresse donnés au bot Messenger en priorité, sinon ceux de la fiche client.
 */
export function OrderCustomerCard({ order, client }: { readonly order: Order; readonly client: Client | null }) {
  const t = useMessages(ordersMessages);
  const { noClient } = useMessages(commonMessages);
  const phone = order.delivery?.phone ?? client?.phone ?? null;
  const address = order.delivery?.address ?? client?.address ?? null;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole={client !== null ? 'link' : undefined}
        accessibilityLabel={client !== null ? t.viewClient : undefined}
        disabled={client === null}
        onPress={() => client !== null && router.push({ pathname: '/clients/[id]', params: { id: client.id } })}
        style={styles.nameRow}
      >
        <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
        <Text style={styles.name} numberOfLines={1}>
          {client?.name ?? noClient}
        </Text>
        {client !== null ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </Pressable>

      {phone !== null ? (
        <Text style={styles.phone} selectable>
          {phone}
        </Text>
      ) : null}
      {address !== null ? (
        <Text style={styles.address} selectable>
          {address}
        </Text>
      ) : null}
      {phone !== null ? (
        <View style={styles.call}>
          <AppButton label={t.callCustomer} onPress={() => void Linking.openURL(`tel:${phoneDigits(phone)}`)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadow, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  name: { flex: 1, fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  phone: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  address: { fontSize: fontSize.md, color: colors.text },
  call: { marginTop: spacing.sm },
});
