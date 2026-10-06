import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { ORDER_STATUS_LABELS, ORDER_STATUSES, OrderStatus, OrderSummary } from '@/models';
import { orderService } from '@/services/order.service';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatDisplayDateTime } from '@/utils/date.utils';
import { formatMoney } from '@/utils/money.utils';
import { MessengerBadges } from './MessengerBadges';
import { OrderStatusBadge } from './OrderStatusBadge';
import { useOrders } from './useOrders';

function OrderRow({ summary }: { readonly summary: OrderSummary }) {
  const { order, clientName, itemCount } = summary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={styles.reference}>{order.reference}</Text>
          <OrderStatusBadge status={order.status} />
        </View>
        <MessengerBadges order={order} />
        <Text style={styles.client} numberOfLines={1}>
          {clientName ?? 'Client non renseigné'}
        </Text>
        <Text style={styles.meta}>
          {formatDisplayDateTime(order.orderedAt)} · {itemCount} produit(s)
        </Text>
      </View>
      <Text style={styles.total}>{formatMoney(order.totalAmount)}</Text>
    </Pressable>
  );
}

export function OrderListScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const { orders, countsByStatus, totalCount, loading, error, reload } = useOrders({ search, status });

  // Le nom d'un client a pu changer depuis un autre écran.
  useFocusEffect(
    useCallback(() => {
      void orderService.load();
    }, []),
  );

  const statusOptions = useMemo<readonly ChipOption<OrderStatus | null>[]>(
    () => [
      { value: null, label: `Toutes (${totalCount})` },
      ...ORDER_STATUSES.map((value) => ({
        value,
        label: `${ORDER_STATUS_LABELS[value]} (${countsByStatus.get(value) ?? 0})`,
      })),
    ],
    [countsByStatus, totalCount],
  );
  const isFiltered = search.trim().length > 0 || status !== null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Commandes' }} />
      <View style={styles.toolbar}>
        <TextInput
          accessibilityLabel="Rechercher une commande"
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher (référence, client)"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCorrect={false}
        />
        <ChipGroup accessibilityLabel="Filtrer par statut" options={statusOptions} selected={status} onSelect={setStatus} />
        <ErrorBanner message={error} />
      </View>

      {loading && orders.length === 0 ? (
        <LoadingView />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(summary) => summary.order.id}
          renderItem={({ item }) => <OrderRow summary={item} />}
          refreshing={loading}
          onRefresh={() => void reload()}
          contentContainerStyle={orders.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <EmptyState
              title={isFiltered ? 'Aucune commande trouvée' : 'Aucune commande'}
              message={isFiltered ? undefined : 'Les commandes reçues sur Messenger apparaissent ici automatiquement.'}
            />
          }
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  search: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  emptyList: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.background },
  rowMain: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reference: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  client: { fontSize: fontSize.md, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  total: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
});
