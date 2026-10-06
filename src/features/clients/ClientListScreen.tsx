import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, spacing } from '@/core/theme/theme';
import { ClientSummary } from '@/models';
import { customerService } from '@/services/customer.service';
import { ListRow } from '@/shared/components/ListRow';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { SearchField } from '@/shared/components/SearchField';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatMoney } from '@/utils/money.utils';
import { clientsMessages } from './clients.messages';
import { useClients } from './useClients';

function ClientRow({ summary }: { readonly summary: ClientSummary }) {
  const t = useMessages(clientsMessages);
  const { client, orderCount, totalSpent } = summary;
  return (
    <ListRow
      title={client.name}
      subtitle={[client.phone, client.address].filter(Boolean).join(' · ') || t.noContact}
      leading={<Thumbnail name={client.name} imageUri={null} size={44} />}
      onPress={() => router.push({ pathname: '/clients/[id]', params: { id: client.id } })}
      trailing={
        <View style={styles.trailing}>
          <Text style={styles.spent}>{formatMoney(totalSpent)}</Text>
          <Text style={styles.orders}>{t.orderCount(orderCount)}</Text>
        </View>
      }
    />
  );
}

export function ClientListScreen() {
  const t = useMessages(clientsMessages);
  const [search, setSearch] = useState('');
  const { summaries, totalCount, loading, error, reload } = useClients(search);
  const isFiltered = search.trim().length > 0;

  // Les chiffres d'un client changent quand ses commandes avancent.
  useFocusEffect(
    useCallback(() => {
      void customerService.load();
    }, []),
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t.title }} />
      <View style={styles.toolbar}>
        <SearchField accessibilityLabel={t.searchLabel} value={search} onChangeText={setSearch} placeholder={t.searchPlaceholder} />
        <Text style={styles.count}>
          {isFiltered ? t.countFiltered(summaries.length, totalCount) : t.countAll(totalCount)}
        </Text>
        <ErrorBanner message={error} />
      </View>

      {loading && summaries.length === 0 ? (
        <LoadingView />
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={(summary) => summary.client.id}
          renderItem={({ item }) => <ClientRow summary={item} />}
          refreshing={loading}
          onRefresh={() => void reload()}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={summaries.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <EmptyState
              icon={isFiltered ? 'search-outline' : 'people-outline'}
              title={isFiltered ? t.emptyFilteredTitle : t.emptyTitle}
              message={isFiltered ? t.emptyFilteredMessage : t.emptyMessage}
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
  count: { color: colors.textMuted, fontSize: fontSize.sm },
  emptyList: { flexGrow: 1 },
  trailing: { alignItems: 'flex-end' },
  spent: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  orders: { fontSize: fontSize.sm, color: colors.textMuted },
});
