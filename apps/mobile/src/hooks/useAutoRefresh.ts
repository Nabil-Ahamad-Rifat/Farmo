import { useCallback } from 'react';
import { AppState } from 'react-native';
import { onDataChanged } from '@/src/lib/syncStore';

const EVERY_MS = 30_000;

/**
 * Keep an open screen fresh: reload every 30 s while it is focused and the app
 * is in front, when the app comes back to the foreground, and when offline
 * entries finish uploading. Pass expo-router's useFocusEffect (kept as an
 * argument so this hook stays easy to reuse and test).
 */
export function useAutoRefresh(reload: () => unknown, useFocusEffect: (effect: () => () => void) => void) {
  useFocusEffect(
    useCallback(() => {
      const tick = setInterval(() => {
        if (AppState.currentState === 'active') reload();
      }, EVERY_MS);
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') reload();
      });
      const off = onDataChanged(() => {
        reload();
      });
      return () => {
        clearInterval(tick);
        sub.remove();
        off();
      };
    }, [reload])
  );
}
