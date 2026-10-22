import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ApiError, createApiClient, isNetworkError, isQueueablePost, type QueuedResult } from '@farm/api-client';
import { cacheGet, cacheSet } from './cache';
import { configureOutbox, enqueue } from './outbox';
import { emitQueued, getSyncState, setSyncState } from './syncStore';
import { generateIdempotencyKey } from './idempotency';
import { setStorageItemAsync } from '@/src/lib/useStorageState';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function getStoredItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

/** The stored Bearer token, for requests apiClient can't make itself (e.g. <Image> photo loads). */
export const getAccessToken = () => getStoredItem('accessToken');

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

// AuthContext registers itself here on mount so that a refresh triggered
// from deep inside apiClient (outside of any signIn/signUp call) can still
// update the React state useStorageState holds — writing straight to
// SecureStore/localStorage below does NOT do that on its own, since
// useStorageState's state is only ever updated through its own setter.
type SessionListener = (tokens: RefreshedTokens | null) => void;
let sessionListener: SessionListener | null = null;
export function setSessionListener(listener: SessionListener | null) {
  sessionListener = listener;
}

// Multiple 401s firing at once (e.g. a screen's list fetch + a background
// refresh) must share one in-flight refresh call — the backend rotates the
// refresh token on every use and treats a second use of an already-rotated
// token as theft/replay, revoking the whole chain. Racing two refresh calls
// with the same stored token would trigger exactly that.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getStoredItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await setStorageItemAsync('accessToken', null);
        await setStorageItemAsync('refreshToken', null);
        await setStorageItemAsync('user', null);
        sessionListener?.(null);
        return false;
      }

      const tokens = (await res.json()) as RefreshedTokens;
      await setStorageItemAsync('accessToken', tokens.accessToken);
      await setStorageItemAsync('refreshToken', tokens.refreshToken);
      sessionListener?.(tokens);
      return true;
    } catch {
      // Network failure talking to /refresh — leave the stored session
      // alone (don't log the user out just because they're offline) and
      // let the original request's error surface as-is.
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// Every request from this client identifies itself as mobile (so the backend
// returns tokens in the response body instead of relying on a cookie — see
// apps/web/src/lib/auth/clientType.ts) and attaches the stored Bearer token
// once one exists. Reads storage directly rather than through AuthContext so
// this stays a standalone module usable from anywhere, not just components.
const baseClient = createApiClient({
  baseUrl: API_URL,
  getAuthHeaders: async () => {
    const token = await getStoredItem('accessToken');
    return {
      'X-Client-Type': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },
  onUnauthorized: refreshSession,
});

// The signed-in user's id (from the stored session), so cached data and
// offline entries never mix between accounts on one phone.
let userMemo: { raw: string; id: string | null } | null = null;
export async function currentUserId(): Promise<string | null> {
  const raw = (await getStoredItem('user')) ?? '';
  if (userMemo?.raw === raw) return userMemo.id;
  let id: string | null = null;
  try {
    id = raw ? ((JSON.parse(raw) as { id?: string }).id ?? null) : null;
  } catch {
    id = null;
  }
  userMemo = { raw, id };
  return id;
}

function wentOnline() {
  if (!getSyncState().online || getSyncState().staleSince !== null) setSyncState({ online: true, staleSince: null });
}

// Offline entries upload through the same client, with their saved key.
configureOutbox(
  (entry) => baseClient.post(entry.path, entry.body, 'Upload failed', { idempotencyKey: entry.idempotencyKey }),
  currentUserId
);

const NEEDS_INTERNET = 'Needs internet — try again when online';

/**
 * The app's API client. Same calls as @farm/api-client, plus offline support:
 * - GET: the answer is saved; with no connection the last saved copy is returned
 *   (getSyncState().staleSince says how old).
 * - POST to a create route (isQueueablePost): with no connection it is saved in
 *   the outbox and resolves to a QueuedResult ({ __queued: true }); check with
 *   isQueued() from @farm/api-client. It uploads by itself when back online.
 * - PUT/DELETE with no connection: ApiError "Needs internet".
 */
export const mobileApiClient = {
  async get<T>(path: string, fallbackErrorMessage = 'Request failed'): Promise<T> {
    try {
      const data = await baseClient.get<T>(path, fallbackErrorMessage);
      wentOnline();
      setSyncState({ lastSyncedAt: Date.now() });
      const userId = await currentUserId();
      if (userId) cacheSet(userId, path, data);
      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        if (getSyncState().online) setSyncState({ online: false });
        const userId = await currentUserId();
        const cached = userId ? await cacheGet<T>(userId, path) : null;
        if (cached) {
          const since = getSyncState().staleSince;
          setSyncState({ staleSince: since === null ? cached.savedAt : Math.min(since, cached.savedAt) });
          return cached.data;
        }
      }
      throw err;
    }
  },

  async post<T>(path: string, body?: unknown, fallbackErrorMessage = 'Request failed', opts?: { idempotencyKey?: string }): Promise<T> {
    if (!isQueueablePost(path)) {
      try {
        return await baseClient.post<T>(path, body, fallbackErrorMessage, opts);
      } catch (err) {
        if (isNetworkError(err)) throw new ApiError(NEEDS_INTERNET, 0);
        throw err;
      }
    }
    // Every create that may be replayed carries a key, so it is never saved twice.
    const idempotencyKey = opts?.idempotencyKey ?? generateIdempotencyKey();
    try {
      const result = await baseClient.post<T>(path, body, fallbackErrorMessage, { idempotencyKey });
      wentOnline();
      return result;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      setSyncState({ online: false });
      const entry = await enqueue(path, body, idempotencyKey);
      emitQueued(entry.label);
      const queued: QueuedResult = { __queued: true, outboxId: entry.id };
      return queued as T;
    }
  },

  async put<T>(path: string, body?: unknown, fallbackErrorMessage = 'Request failed'): Promise<T> {
    try {
      return await baseClient.put<T>(path, body, fallbackErrorMessage);
    } catch (err) {
      if (isNetworkError(err)) throw new ApiError(NEEDS_INTERNET, 0);
      throw err;
    }
  },

  async delete<T>(path: string, fallbackErrorMessage = 'Request failed'): Promise<T> {
    try {
      return await baseClient.delete<T>(path, fallbackErrorMessage);
    } catch (err) {
      if (isNetworkError(err)) throw new ApiError(NEEDS_INTERNET, 0);
      throw err;
    }
  },
};
