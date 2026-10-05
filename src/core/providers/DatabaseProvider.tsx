import { ReactNode, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { DATABASE_NAME } from '@/core/constants/app.constants';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, spacing } from '@/core/theme/theme';
import { initializeDatabase } from '@/database/database';
import { AppButton } from '@/shared/components/AppButton';
import { EmptyState } from '@/shared/components/StatusViews';
import { SingleTabGuard } from './SingleTabGuard';

interface DatabaseProviderProps {
  readonly children: ReactNode;
}

/**
 * Ouvre la base SQLite et applique les migrations avant d'afficher l'application.
 * En cas d'échec, affiche un écran explicite avec « Réessayer » au lieu de planter.
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const handleError = useCallback((caught: Error) => setError(toErrorMessage(caught)), []);
  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  if (error !== null) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Impossible d'ouvrir les données" message={error} />
        <View style={styles.actions}>
          <AppButton label="Réessayer" onPress={retry} />
        </View>
      </View>
    );
  }

  return (
    <SingleTabGuard>
      <SQLiteProvider key={attempt} databaseName={DATABASE_NAME} onInit={initializeDatabase} onError={handleError}>
        {children}
      </SQLiteProvider>
    </SingleTabGuard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
});
