// Sync status for the Settings "Data & sync" panel and the offline banner:
// network state (NetInfo), last refresh, and the offline outbox.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { OutboxEntry } from '@farm/api-client';
import { discardEntry, refreshOutboxState, replayPending, retryEntry } from './outbox';
import { emitDataChanged, getSyncState, setSyncState, subscribeSync } from './syncStore';

export interface OutboxFailure {
  id: string;
  /** What the entry was, e.g. "Sale to Rahim Dairy ৳840". */
  label: string;
  /** Server or network message from the last attempt. */
  error: string;
  createdAt: string;
}

export interface SyncStatus {
  online: boolean;
  /** ISO time of the last successful refresh from the server, or null. */
  lastSyncedAt: string | null;
  /** New entries saved offline and waiting to upload. */
  pending: number;
  /** Entries the server refused; the owner can retry or discard them. */
  failed: OutboxFailure[];
  /** True while an upload or refresh is running. */
  syncing: boolean;
  syncNow: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
}

let started = false;

/**
 * Start watching the network and app state once (called by the hooks below).
 * Coming back online or to the foreground uploads waiting entries; coming back
 * online also reloads open screens that were showing saved data.
 */
export function startSync() {
  if (started) return;
  started = true;
  refreshOutboxState().then(() => replayPending());
  NetInfo.addEventListener((net) => {
    const online = net.isConnected !== false && net.isInternetReachable !== false;
    const was = getSyncState().online;
    if (online === was) return;
    setSyncState({ online });
    if (online) {
      replayPending().finally(() => emitDataChanged());
    }
  });
  AppState.addEventListener('change', (s) => {
    if (s === 'active') replayPending();
  });
}

async function syncNow() {
  await replayPending();
  emitDataChanged();
}

function useSyncState() {
  useEffect(() => {
    startSync();
  }, []);
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}

export function useSyncStatus(): SyncStatus {
  const state = useSyncState();
  return useMemo(
    () => ({
      online: state.online,
      lastSyncedAt: state.lastSyncedAt ? new Date(state.lastSyncedAt).toISOString() : null,
      pending: state.entries.filter((e) => e.status === 'pending').length,
      failed: state.entries
        .filter((e) => e.status === 'failed')
        .map((e) => ({ id: e.id, label: e.label, error: e.lastError ?? 'Refused by the server', createdAt: e.createdAt })),
      syncing: state.syncing,
      syncNow,
      retry: retryEntry,
      discard: discardEntry,
    }),
    [state]
  );
}

/** Banner details: offline, how old the shown data is, and what is waiting. */
export function useOfflineBanner() {
  const state = useSyncState();
  return {
    online: state.online,
    staleSince: state.staleSince,
    syncing: state.syncing,
    pending: state.entries.filter((e) => e.status === 'pending').length,
  };
}

/**
 * Offline entries still waiting to upload whose path matches, newest first,
 * for showing at the top of a list with a "Waiting to sync" badge.
 */
export function usePendingFor(match: RegExp | string): OutboxEntry[] {
  const state = useSyncState();
  return useMemo(
    () =>
      state.entries
        .filter((e) => e.status === 'pending' && (typeof match === 'string' ? e.path === match : match.test(e.path)))
        .slice()
        .reverse(),
    [state, match]
  );
}
