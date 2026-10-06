import { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMessages } from '@/core/i18n/i18n';
import { colors } from '@/core/theme/theme';
import { EmptyState, LoadingView } from '@/shared/components/StatusViews';
import { providersMessages } from './providers.messages';

const LOCK_NAME = 'carnet-digital-database';

type TabStatus = 'checking' | 'owner' | 'waiting';

interface SingleTabGuardProps {
  readonly children: ReactNode;
}

/**
 * Web : SQLite (OPFS) ne peut être ouvert que par un seul onglet à la fois ; un second onglet
 * corromprait l'accès (« Invalid VFS state »). On réserve la base avec un verrou Web Locks :
 * un autre onglet affiche un message et prend automatiquement le relais quand le premier se ferme.
 */
export function SingleTabGuard({ children }: SingleTabGuardProps) {
  const t = useMessages(providersMessages);
  const [status, setStatus] = useState<TabStatus>('checking');

  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.locks === undefined) {
      // Navigateur sans Web Locks : on tente l'ouverture sans protection.
      queueMicrotask(() => setStatus('owner'));
      return;
    }

    const abort = new AbortController();
    let release: (() => void) | null = null;
    const holdLock = () =>
      new Promise<void>((resolve) => {
        release = resolve;
        setStatus('owner');
      });

    void navigator.locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (lock !== null) {
          return holdLock();
        }
        setStatus('waiting');
        // Attend que l'autre onglet libère la base, puis la réserve à son tour.
        return navigator.locks
          .request(LOCK_NAME, { signal: abort.signal }, holdLock)
          .catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      abort.abort();
      release?.();
    };
  }, []);

  if (status === 'owner') {
    return <>{children}</>;
  }
  if (status === 'checking') {
    return <LoadingView />;
  }
  return (
    <View style={styles.screen}>
      <EmptyState title={t.otherTabTitle} message={t.otherTabMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
