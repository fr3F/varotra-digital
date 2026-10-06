import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { Client, EntityId } from '@/models';
import { AppButton } from './AppButton';
import { SelectionModal } from './SelectionModal';

interface ClientPickerProps {
  readonly clients: readonly Client[];
  readonly selectedId: EntityId | null;
  readonly onChange: (clientId: EntityId | null) => void;
  readonly disabled?: boolean;
  readonly emptyLabel?: string;
}

/** Champ « Client » : choix dans le carnet, sans client, ou création d'un nouveau client. */
export function ClientPicker({
  clients,
  selectedId,
  onChange,
  disabled = false,
  emptyLabel = 'Aucun client sélectionné',
}: ClientPickerProps) {
  const [visible, setVisible] = useState(false);
  const selected = clients.find((client) => client.id === selectedId) ?? null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Client</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choisir le client"
        onPress={() => setVisible(true)}
        disabled={disabled}
        style={styles.box}
      >
        <View style={styles.texts}>
          <Text style={styles.name}>{selected?.name ?? emptyLabel}</Text>
          {selected?.phone ? <Text style={styles.meta}>{selected.phone}</Text> : null}
        </View>
        <Text style={styles.change}>{selected === null ? 'Choisir' : 'Changer'}</Text>
      </Pressable>

      <SelectionModal
        visible={visible}
        title="Choisir un client"
        items={clients}
        keyOf={(client) => client.id}
        searchTextOf={(client) => `${client.name} ${client.phone ?? ''}`}
        emptyMessage="Aucun client enregistré."
        onClose={() => setVisible(false)}
        onSelect={(client) => {
          onChange(client.id);
          setVisible(false);
        }}
        header={
          <View style={styles.actions}>
            <View style={styles.action}>
              <AppButton
                label="Sans client"
                variant="secondary"
                onPress={() => {
                  onChange(null);
                  setVisible(false);
                }}
              />
            </View>
          </View>
        }
        renderItem={(client) => (
          <View style={styles.option}>
            <Text style={styles.name}>{client.name}</Text>
            {client.phone ? <Text style={styles.meta}>{client.phone}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  texts: { flex: 1 },
  name: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  change: { color: colors.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  option: { padding: spacing.md },
});
