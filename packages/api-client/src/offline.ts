// Platform-free pieces of the mobile offline outbox: which requests may be
// saved offline, the "queued" result a screen gets back, and the replay loop.
// Storage (SQLite / localStorage) and network status live in apps/mobile.
import { ApiError } from './errors';

/**
 * Creates that can be recorded offline and uploaded later. Every matching
 * server route is wrapped in withIdempotency, so a replay never duplicates.
 * Edits and deletes are never queued (they need internet).
 */
const QUEUEABLE: RegExp[] = [
  /^\/api\/sales$/,
  /^\/api\/customers\/[^/]+\/payments$/,
  /^\/api\/suppliers\/[^/]+\/payments$/,
  /^\/api\/expenses$/,
  /^\/api\/income$/,
  /^\/api\/feed$/,
  /^\/api\/feed\/usage$/,
  /^\/api\/cows$/,
  /^\/api\/cows\/[^/]+\/events$/,
  /^\/api\/employees\/[^/]+\/payments$/,
  /^\/api\/employees\/[^/]+\/absences$/,
  /^\/api\/employees\/[^/]+\/work$/,
];

export function isQueueablePost(path: string): boolean {
  const bare = path.split('?')[0];
  return QUEUEABLE.some((re) => re.test(bare));
}

/** fetch() itself failed: no response at all (offline, server unreachable). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

/** What a POST resolves to when it was saved offline instead of sent. */
export interface QueuedResult {
  __queued: true;
  outboxId: string;
}

export function isQueued(value: unknown): value is QueuedResult {
  return typeof value === 'object' && value !== null && (value as QueuedResult).__queued === true;
}

export interface OutboxEntry {
  id: string;
  /** The signed-in user who saved it; only that user's session uploads it. */
  userId: string;
  method: 'POST';
  path: string;
  body: unknown;
  idempotencyKey: string;
  /** Human description for the Settings panel, e.g. "Sale · Rahim Dairy ৳840". */
  label: string;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'failed';
  lastError: string | null;
}

export interface ReplayOutcome {
  uploaded: string[];
  failed: { id: string; error: string }[];
  /** True when the loop stopped early (offline again, server down, signed out). */
  stopped: boolean;
}

/**
 * Upload pending entries one at a time, oldest first. A network error or a
 * 5xx/401 stops the loop (try again later, nothing lost); any other HTTP
 * error means the server refused that entry, so it is marked failed and the
 * loop moves on to the next one.
 */
export async function replayOutbox(entries: OutboxEntry[], send: (entry: OutboxEntry) => Promise<unknown>): Promise<ReplayOutcome> {
  const outcome: ReplayOutcome = { uploaded: [], failed: [], stopped: false };
  const queue = entries.filter((e) => e.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of queue) {
    try {
      await send(entry);
      outcome.uploaded.push(entry.id);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      if (status === 0 || status === 401 || status === 429 || status >= 500 || status === -1) {
        outcome.stopped = true;
        break;
      }
      outcome.failed.push({ id: entry.id, error: (err as Error).message || 'The server refused this entry' });
    }
  }
  return outcome;
}

/** A short label for an offline entry, from its path and body. */
export function describeEntry(path: string, body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const money = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && v !== '') ? ` ৳${v}` : '');
  const bare = path.split('?')[0];
  if (bare === '/api/sales') return `Sale${b.customerName ? ` · ${String(b.customerName)}` : ''}${money(b.amount)}`;
  if (/\/api\/customers\/[^/]+\/payments$/.test(bare)) return `Payment received${money(b.amount)}`;
  if (/\/api\/suppliers\/[^/]+\/payments$/.test(bare)) return `Paid supplier${money(b.amount)}`;
  if (bare === '/api/expenses') return `Expense${b.description ? ` · ${String(b.description)}` : ''}${money(b.amount)}`;
  if (bare === '/api/income') return `Income${b.description ? ` · ${String(b.description)}` : ''}${money(b.amount)}`;
  if (bare === '/api/feed') return `Feed bought${b.name ? ` · ${String(b.name)}` : ''}`;
  if (bare === '/api/feed/usage') return `Feed used${b.quantity ? ` · ${String(b.quantity)} kg` : ''}`;
  if (bare === '/api/cows') return `New animal${b.tagNumber ? ` · ${String(b.tagNumber)}` : ''}`;
  if (/\/api\/cows\/[^/]+\/events$/.test(bare)) return `Animal record${b.type ? ` · ${String(b.type)}` : ''}`;
  if (/\/payments$/.test(bare)) return `Worker paid${money(b.amount)}`;
  if (/\/absences$/.test(bare)) return 'Worker absence';
  if (/\/work$/.test(bare)) return 'Worker days';
  return 'Entry';
}
