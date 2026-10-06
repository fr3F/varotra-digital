import { StyleSheet, View } from 'react-native';
import { LanguageMenu } from '@/core/i18n/LanguageMenu';
import { spacing } from '@/core/theme/theme';
import { NotificationBell } from './NotificationBell';

/** À droite de chaque en-tête : cloche des notifications et menu des langues. */
export function HeaderActions() {
  return (
    <View style={styles.row}>
      <NotificationBell />
      <LanguageMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: spacing.lg },
});
