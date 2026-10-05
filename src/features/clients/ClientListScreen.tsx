import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { ClientSummary } from '@/models';
import { customerService } from '@/services/customer.service';
import { AppButton } from '@/shared/components/AppButton';
import { ListRow } from '@/shared/components/ListRow';
import { Thumbnail } from '@/shared/components/Thumbnail';
import { EmptyState, ErrorBanner, LoadingView } from '@/shared/components/StatusViews';
import { formatMoney } from '@/utils/money.utils';
import { useClients } from './useClients';

function ClientRow({ summary }: { readonly summary: ClientSummary }) {
  const { client, orderCount, totalSpent } = summary;
  return (
    <ListRow
      title={client.name}
      subtitle={[client.phone, client.address].filter(Boolean).join(' · ') || 'Aucune coordonnée'}
      leading={<Thumbnail name={client.name} imageUri={null} size={44} />}
      onPress={() => router.push({ pathname: '/clients/[id]', params: { id: client.id } })}
      trailing={
        <View style={styles.trailing}>
          <Text style={styles.spent}>{formatMoney(totalSpent)}</Text>
          <Text style={styles.orders}>{orderCount} commande(s)</Text>
        </View>
      }
    />
  );
}

export function ClientListScreen() {
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
      <Stack.Screen options={{ title: 'Clients' }} />
      <View style={styles.toolbar}>
        <TextInput
          accessibilityLabel="Rechercher un client"
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher (nom, téléphone, adresse)"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCorrect={false}
        />
        <Text style={styles.count}>
          {isFiltered ? `${summaries.length} sur ${totalCount} client(s)` : `${totalCount} client(s)`}
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
              title={isFiltered ? 'Aucun client trouvé' : 'Aucun client'}
              message={isFiltered ? 'Essayez un autre nom ou numéro.' : 'Ajoutez vos clients pour suivre leurs achats.'}
            />
          }
        />
      )}

      <View style={styles.footer}>
        <AppButton label="+ Nouveau client" onPress={() => router.push('/clients/new')} />
      </View>
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
  count: { color: colors.textMuted, fontSize: fontSize.sm },
  emptyList: { flexGrow: 1 },
  trailing: { alignItems: 'flex-end' },
  spent: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  orders: { fontSize: fontSize.sm, color: colors.textMuted },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
