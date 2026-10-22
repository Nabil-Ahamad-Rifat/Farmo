import { kvDeletePrefix, kvGet, kvSet } from './kv';

// The last good answer for every GET, per signed-in user, so screens still
// show data when the phone is offline. Keys: "c:<userId>:<path>".

const key = (userId: string, path: string) => `c:${userId}:${path}`;

export interface CachedResponse<T> {
  data: T;
  savedAt: number;
}

export async function cacheGet<T>(userId: string, path: string): Promise<CachedResponse<T> | null> {
  try {
    const row = await kvGet(key(userId, path));
    return row ? { data: JSON.parse(row.json) as T, savedAt: row.savedAt } : null;
  } catch {
    return null;
  }
}

export async function cacheSet(userId: string, path: string, data: unknown): Promise<void> {
  try {
    await kvSet(key(userId, path), JSON.stringify(data));
  } catch {
    // A failed cache write never breaks the online app.
  }
}

/** Forget one user's cached data (sign out / delete account). */
export async function cacheClear(userId: string): Promise<void> {
  try {
    await kvDeletePrefix(`c:${userId}:`);
  } catch {
    // ignore
  }
}
