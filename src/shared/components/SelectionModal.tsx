import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { EmptyState } from './StatusViews';

interface SelectionModalProps<T> {
  readonly visible: boolean;
  readonly title: string;
  readonly items: readonly T[];
  readonly keyOf: (item: T) => string;
  /** Texte sur lequel porte la recherche. */
  readonly searchTextOf: (item: T) => string;
  readonly renderItem: (item: T) => ReactElement;
  readonly onSelect: (item: T) => void;
  readonly onClose: () => void;
  readonly emptyMessage?: string;
  /** Contenu affiché sous la recherche (ex. action « Aucun client »). */
  readonly header?: ReactNode;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}

/** Liste plein écran avec recherche, pour choisir un élément (client, produit…). */
export function SelectionModal<T>({
  visible,
  title,
  items,
  keyOf,
  searchTextOf,
  renderItem,
  onSelect,
  onClose,
  emptyMessage = 'Aucun élément.',
  header,
}: SelectionModalProps<T>) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = normalize(search);
    return query.length === 0 ? items : items.filter((item) => normalize(searchTextOf(item)).includes(query));
  }, [items, search, searchTextOf]);

  const close = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable accessibilityRole="button" onPress={close} hitSlop={12}>
            <Text style={styles.close}>Fermer</Text>
          </Pressable>
        </View>
        <View style={styles.toolbar}>
          <TextInput
            accessibilityLabel={`Rechercher : ${title}`}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            autoCorrect={false}
          />
          {header}
        </View>
        <FlatList
          data={filtered}
          keyExtractor={keyOf}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSearch('');
                onSelect(item);
              }}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            >
              {renderItem(item)}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title={search ? 'Aucun résultat' : emptyMessage} />}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
  },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.onPrimary },
  close: { fontSize: fontSize.md, fontWeight: '600', color: colors.onPrimary },
  toolbar: { padding: spacing.lg, gap: spacing.sm },
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
  option: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionPressed: { backgroundColor: colors.background },
});
