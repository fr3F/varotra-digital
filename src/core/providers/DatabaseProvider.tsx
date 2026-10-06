import { ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SQLiteProvider } from 'expo-sqlite';
import { DATABASE_NAME } from '@/core/constants/app.constants';
import { toErrorMessage } from '@/core/errors/app-error';
import { colors, spacing } from '@/core/theme/theme';
import { initializeDatabase } from '@/database/database';
import { AppButton } from '@/shared/components/AppButton';
import { EmptyState } from '@/shared/components/StatusViews';
import { BrandSplash } from './BrandSplash';
import { SingleTabGuard } from './SingleTabGuard';

/** Monté par SQLiteProvider seulement quand la base est prête : retire l'écran de démarrage. */
function ReadySignal({ onReady }: { readonly onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

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
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

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
      <View style={styles.root}>
        <SQLiteProvider key={attempt} databaseName={DATABASE_NAME} onInit={initializeDatabase} onError={handleError}>
          <ReadySignal onReady={markReady} />
          {children}
        </SQLiteProvider>
        {ready ? null : <BrandSplash />}
      </View>
    </SingleTabGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
});
