import { describeEntry, replayOutbox, type OutboxEntry } from '@farm/api-client';
import { kvDelete, kvDeletePrefix, kvList, kvSet } from './kv';
import { emitDataChanged, getSyncState, setSyncState } from './syncStore';

// New entries saved while offline ("o:<userId>:<id>" rows), uploaded later
// with their Idempotency-Key so the server never creates them twice.
// The API client injects how to send and who is signed in (avoids an import cycle).

type Sender = (entry: OutboxEntry) => Promise<unknown>;
let sender: Sender | null = null;
let currentUser: () => Promise<string | null> = async () => null;

export function configureOutbox(send: Sender, getUserId: () => Promise<string | null>) {
  sender = send;
  currentUser = getUserId;
}

const rowKey = (e: Pick<OutboxEntry, 'userId' | 'id'>) => `o:${e.userId}:${e.id}`;

async function save(entry: OutboxEntry) {
  await kvSet(rowKey(entry), JSON.stringify(entry));
}

/** Reload the signed-in user's outbox into the shared store (counts, failures, pending lists). */
export async function refreshOutboxState(): Promise<OutboxEntry[]> {
  const userId = await currentUser();
  const entries = userId
    ? (await kvList(`o:${userId}:`)).map((r) => JSON.parse(r.json) as OutboxEntry).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  setSyncState({ entries });
  return entries;
}

let seq = 0;

export async function enqueue(path: string, body: unknown, idempotencyKey: string): Promise<OutboxEntry> {
  const userId = await currentUser();
  if (!userId) throw new Error('Please sign in again to save entries.');
  seq += 1;
  const entry: OutboxEntry = {
    id: `${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId,
    method: 'POST',
    path,
    body,
    idempotencyKey,
    label: describeEntry(path, body),
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    lastError: null,
  };
  await save(entry);
  await refreshOutboxState();
  return entry;
}

let running: Promise<void> | null = null;

/** Upload waiting entries, oldest first. Safe to call often: runs one at a time. */
export function replayPending(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const entries = await refreshOutboxState();
      if (!sender || !entries.some((e) => e.status === 'pending')) return;
      setSyncState({ syncing: true });
      const send = sender;
      const outcome = await replayOutbox(entries, async (entry) => {
        entry.attempts += 1;
        await send(entry);
      });
      for (const id of outcome.uploaded) {
        const e = entries.find((x) => x.id === id);
        if (e) await kvDelete(rowKey(e));
      }
      for (const f of outcome.failed) {
        const e = entries.find((x) => x.id === f.id);
        if (e) await save({ ...e, status: 'failed', lastError: f.error });
      }
      // Remember the attempt count of entries still waiting.
      for (const e of entries) {
        if (e.status === 'pending' && !outcome.uploaded.includes(e.id) && !outcome.failed.some((f) => f.id === e.id)) await save(e);
      }
      await refreshOutboxState();
      if (outcome.uploaded.length) emitDataChanged();
    } finally {
      setSyncState({ syncing: false });
      running = null;
    }
  })();
  return running;
}

/** Try a failed entry again (moves it back to pending, then uploads). */
export async function retryEntry(id: string) {
  const e = getSyncState().entries.find((x) => x.id === id);
  if (!e) return;
  await save({ ...e, status: 'pending', lastError: null });
  await replayPending();
}

export async function discardEntry(id: string) {
  const e = getSyncState().entries.find((x) => x.id === id);
  if (!e) return;
  await kvDelete(rowKey(e));
  await refreshOutboxState();
}

/** Drop a user's whole outbox (their account was deleted). */
export async function clearOutbox(userId: string) {
  await kvDeletePrefix(`o:${userId}:`);
  await refreshOutboxState();
}
