import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';

export function LoadingView() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

interface EmptyStateProps {
  readonly title: string;
  readonly message?: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

interface ErrorBannerProps {
  readonly message: string | null;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (message === null) {
    return null;
  }
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, textAlign: 'center' },
  emptyMessage: { marginTop: spacing.sm, fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center' },
  banner: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { color: colors.danger, fontSize: fontSize.sm },
});
