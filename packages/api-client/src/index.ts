// One typed request function shared between apps/web and apps/mobile,
// parameterized by base URL and auth-header injection (cookie-based for
// web — the browser sends the httpOnly cookie automatically on same-origin
// requests, so web needs no getAuthHeaders at all — Bearer-token-based for
// mobile, via getAuthHeaders reading from SecureStore).
//
// Encapsulates the fetch + res.ok + data.error pattern every
// apps/web/src/components/*Manager.tsx previously repeated by hand. This is
// also the choke point the mobile offline outbox builds on (./offline.ts:
// which creates may be queued, the queued result, and the replay loop).

import { ApiError } from './errors';

export { ApiError };
export {
  isQueueablePost,
  isNetworkError,
  isQueued,
  replayOutbox,
  describeEntry,
  type QueuedResult,
  type OutboxEntry,
  type ReplayOutcome,
} from './offline';

export interface ApiClientOptions {
  /** Prefixed to every path. Leave empty for same-origin (web); mobile passes an absolute URL. */
  baseUrl?: string;
  /** Extra headers (e.g. Authorization: Bearer ...) to attach to every request. */
  getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /**
   * Called once when a request comes back 401. Should attempt to refresh the
   * session (e.g. exchange a refresh token for a new access token) and
   * resolve `true` if it succeeded — the request is then retried exactly
   * once with fresh `getAuthHeaders()`. Resolving `false` (or omitting this
   * option) leaves the 401 to surface as a normal ApiError. Mobile wires
   * this to /api/auth/refresh; web (cookie auth, no refresh token) omits it.
   */
  onUnauthorized?: () => Promise<boolean>;
}

interface RequestOpts {
  idempotencyKey?: string;
}

async function request<T>(
  baseUrl: string,
  getAuthHeaders: ApiClientOptions['getAuthHeaders'],
  onUnauthorized: ApiClientOptions['onUnauthorized'],
  path: string,
  init: RequestInit,
  fallbackErrorMessage: string,
  isRetry = false
): Promise<T> {
  const authHeaders = getAuthHeaders ? await getAuthHeaders() : undefined;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    // fetch() itself threw — no response at all (offline, DNS failure, the
    // dev server isn't reachable), as opposed to the server responding with
    // an error status. Distinct, clearer message than the generic fallback,
    // and a distinct status (0, never a real HTTP code) so callers that
    // care can tell the two apart.
    throw new ApiError('You appear to be offline. Check your connection and try again.', 0);
  }

  if (res.status === 401 && !isRetry && onUnauthorized) {
    const refreshed = await onUnauthorized();
    if (refreshed) {
      return request(baseUrl, getAuthHeaders, onUnauthorized, path, init, fallbackErrorMessage, true);
    }
  }

  if (!res.ok) {
    let message = fallbackErrorMessage;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // Non-JSON error body — keep the fallback message.
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '';

  return {
    get: <T>(path: string, fallbackErrorMessage = 'Request failed') =>
      request<T>(baseUrl, options.getAuthHeaders, options.onUnauthorized, path, { method: 'GET' }, fallbackErrorMessage),

    post: <T>(path: string, body?: unknown, fallbackErrorMessage = 'Request failed', opts?: RequestOpts) =>
      request<T>(
        baseUrl,
        options.getAuthHeaders,
        options.onUnauthorized,
        path,
        {
          method: 'POST',
          body: body !== undefined ? JSON.stringify(body) : undefined,
          headers: opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined,
        },
        fallbackErrorMessage
      ),

    put: <T>(path: string, body?: unknown, fallbackErrorMessage = 'Request failed') =>
      request<T>(
        baseUrl,
        options.getAuthHeaders,
        options.onUnauthorized,
        path,
        { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined },
        fallbackErrorMessage
      ),

    delete: <T>(path: string, fallbackErrorMessage = 'Request failed') =>
      request<T>(baseUrl, options.getAuthHeaders, options.onUnauthorized, path, { method: 'DELETE' }, fallbackErrorMessage),
  };
}

// Web default: relative URLs, cookie auth handled automatically by the browser.
// On a 401 (expired/invalid session cookie) redirect straight to /login instead
// of leaving a raw "Unauthorized" string in whatever form/list happened to be
// open — there's no refresh token to recover with on web, unlike mobile.
// Accessed via a structural type on globalThis (not `window` directly) so
// this file doesn't need the DOM lib — it's also imported by apps/mobile,
// which has no window at all; the check is a no-op there regardless, since
// mobile builds its own client instead of using this export.
export const webApiClient = createApiClient({
  onUnauthorized: async () => {
    const withWindow = globalThis as { window?: { location: { href: string } } };
    if (withWindow.window) {
      withWindow.window.location.href = '/login';
    }
    return false;
  },
});
