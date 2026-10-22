// Small persistent key-value store for the offline cache and outbox.
// Web (Expo web preview): localStorage. Phones use kv.native.ts (SQLite);
// Metro picks the platform file, TypeScript checks against this one.
const PREFIX = 'farmkv:';

export interface KvRow {
  key: string;
  json: string;
  savedAt: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<KvRow | null> {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as KvRow) : null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, json: string): Promise<void> {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify({ key, json, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the app still works online, just without the offline copy.
  }
}

export async function kvDelete(key: string): Promise<void> {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Every row whose key starts with prefix. */
export async function kvList(prefix: string): Promise<KvRow[]> {
  const s = storage();
  if (!s) return [];
  const rows: KvRow[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k || !k.startsWith(PREFIX + prefix)) continue;
      const raw = s.getItem(k);
      if (raw) rows.push(JSON.parse(raw) as KvRow);
    }
  } catch {
    // ignore unreadable rows
  }
  return rows;
}

export async function kvDeletePrefix(prefix: string): Promise<void> {
  for (const row of await kvList(prefix)) await kvDelete(row.key);
}
