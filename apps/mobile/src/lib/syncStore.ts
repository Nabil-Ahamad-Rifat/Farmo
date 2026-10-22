// Shared offline/sync state (no React, no network): the API client, the
// outbox and the UI all read and update this one store.
import type { OutboxEntry } from '@farm/api-client';

export interface SyncState {
  online: boolean;
  /** Last time a GET came back from the server (ms), or null. */
  lastSyncedAt: number | null;
  /** Set while screens show cached data: the saved time of the oldest copy shown (ms). */
  staleSince: number | null;
  syncing: boolean;
  /** Outbox entries of the signed-in user (pending and failed). */
  entries: OutboxEntry[];
}

let state: SyncState = { online: true, lastSyncedAt: null, staleSince: null, syncing: false, entries: [] };
const listeners = new Set<() => void>();

export function getSyncState(): SyncState {
  return state;
}

export function setSyncState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function subscribeSync(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// "Data changed on the server" (an offline entry uploaded, Sync now pressed):
// open screens reload their lists.
const dataListeners = new Set<() => void>();

export function onDataChanged(listener: () => void) {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
}

export function emitDataChanged() {
  for (const l of dataListeners) l();
}

// "Saved offline" (a create was queued): the header shows one toast for it.
const queuedListeners = new Set<(label: string) => void>();

export function onQueued(listener: (label: string) => void) {
  queuedListeners.add(listener);
  return () => {
    queuedListeners.delete(listener);
  };
}

export function emitQueued(label: string) {
  for (const l of queuedListeners) l(label);
}
