import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { useStore } from '@/core/state/store';
import { CustomerReplyEntry } from '@/models';
import { facebookReplyService } from '@/services/messenger/facebook-reply.service';
import { messengerOutboxVersion, messengerStore } from '@/services/messenger/messenger-state';
import { ChipGroup, ChipOption } from '@/shared/components/ChipGroup';
import { StatCard } from '@/shared/components/StatCard';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { useQuery } from '@/shared/hooks/useQuery';
import { ReplyRow } from './ReplyRow';

type ReplyFilter = 'ALL' | 'AUTO' | 'MANUAL' | 'PROBLEM';

const FILTERS: readonly ChipOption<ReplyFilter>[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'AUTO', label: 'Automatiques' },
  { value: 'MANUAL', label: 'Vendeur' },
  { value: 'PROBLEM', label: 'Non envoyées' },
];

function matches(entry: CustomerReplyEntry, filter: ReplyFilter): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'AUTO':
      return entry.reply.automatic;
    case 'MANUAL':
      return !entry.reply.automatic;
    case 'PROBLEM':
      return entry.reply.result !== null && entry.reply.result !== 'DELIVERED';
  }
}

/** Historique des réponses Facebook envoyées aux clients (automatiques et manuelles). */
export function ReplyHistoryScreen() {
  const [filter, setFilter] = useState<ReplyFilter>('ALL');
  const version = useStore(messengerOutboxVersion) + useStore(messengerStore).syncCount;
  const fetchReplies = useCallback(() => facebookReplyService.recent(), []);
  const { data, loading, error, reload } = useQuery(fetchReplies, version);

  const entries = useMemo(() => (data ?? []).filter((entry) => matches(entry, filter)), [data, filter]);
  const stats = useMemo(() => {
    const all = data ?? [];
    return {
      confirmed: all.filter((entry) => entry.reply.automatic && entry.reply.kind === 'CONFIRMED').length,
      unavailable: all.filter((entry) => entry.reply.kind === 'UNAVAILABLE').length,
      pending: all.filter((entry) => entry.reply.result === null).length,
    };
  }, [data]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Réponses Facebook' }} />
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.reply.id}
        refreshing={loading && data !== null}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.grid}>
              <StatCard label="Confirmées auto." value={String(stats.confirmed)} tone="positive" />
              <StatCard
                label="Indisponibles"
                value={String(stats.unavailable)}
                tone={stats.unavailable > 0 ? 'warning' : 'default'}
              />
            </View>
            {stats.pending > 0 ? (
              <Text style={styles.pending}>{stats.pending} réponse(s) en attente de réseau.</Text>
            ) : null}
            <ChipGroup accessibilityLabel="Filtrer les réponses" options={FILTERS} selected={filter} onSelect={setFilter} />
            <ErrorBanner message={error} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/orders/[id]', params: { id: item.reply.orderId } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <ReplyRow reply={item.reply} heading={`${item.orderReference} · ${item.clientName ?? 'Client Messenger'}`} />
          </Pressable>
        )}
        ListEmptyComponent={
          data === null ? (
            <LoadingView />
          ) : (
            <EmptyState
              title="Aucune réponse"
              message="Les réponses envoyées aux clients Messenger (automatiques ou non) apparaîtront ici."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pending: { fontSize: fontSize.sm, fontWeight: '600', color: colors.warning },
  row: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.background },
});
