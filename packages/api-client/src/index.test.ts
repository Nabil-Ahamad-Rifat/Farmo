import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient, ApiError } from './index';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error('Expected promise to reject');
}

describe('createApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with the parsed JSON body on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = createApiClient({ baseUrl: 'https://api.test' });

    const result = await client.get<{ ok: boolean }>('/thing');

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('https://api.test/thing', expect.objectContaining({ method: 'GET' }));
  });

  it('throws an ApiError with the server-provided message on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'Bad input' }));
    const client = createApiClient({ baseUrl: 'https://api.test' });

    const err = await captureError(client.post('/thing'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Bad input');
    expect(err.status).toBe(400);
  });

  it('falls back to the caller-provided message when the error body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('not json', { status: 500 }));
    const client = createApiClient({ baseUrl: 'https://api.test' });

    const err = await captureError(client.get('/thing', 'Request failed'));
    expect(err.message).toBe('Request failed');
    expect(err.status).toBe(500);
  });

  it('attaches an Idempotency-Key header only when one is passed', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(201, {})));
    global.fetch = fetchMock;
    const client = createApiClient({ baseUrl: 'https://api.test' });

    await client.post('/things', { a: 1 }, 'failed', { idempotencyKey: 'key-1' });
    const headersWithKey = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headersWithKey['Idempotency-Key']).toBe('key-1');

    await client.post('/things', { a: 1 });
    const headersWithoutKey = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(headersWithoutKey['Idempotency-Key']).toBeUndefined();
  });

  it('surfaces a distinct offline message when fetch itself throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));
    const client = createApiClient({ baseUrl: 'https://api.test' });

    const err = await captureError(client.get('/thing'));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/offline/i);
  });

  it('leaves a 401 as a normal ApiError when no onUnauthorized handler is set', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));
    const client = createApiClient({ baseUrl: 'https://api.test' });

    const err = await captureError(client.get('/thing'));
    expect(err.status).toBe(401);
  });

  it('refreshes and retries exactly once on a 401 when onUnauthorized succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock;

    const onUnauthorized = vi.fn().mockResolvedValue(true);
    const client = createApiClient({ baseUrl: 'https://api.test', onUnauthorized });

    const result = await client.get<{ ok: boolean }>('/thing');

    expect(result).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a second time if the retried request also 401s', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));
    const onUnauthorized = vi.fn().mockResolvedValue(true);
    const client = createApiClient({ baseUrl: 'https://api.test', onUnauthorized });

    const err = await captureError(client.get('/thing'));
    expect(err.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('surfaces the original 401 without retrying when onUnauthorized fails to refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));
    global.fetch = fetchMock;
    const onUnauthorized = vi.fn().mockResolvedValue(false);
    const client = createApiClient({ baseUrl: 'https://api.test', onUnauthorized });

    const err = await captureError(client.get('/thing'));
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-reads getAuthHeaders on the retry so a refreshed token is used', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    let token = 'stale-token';
    const getAuthHeaders = vi.fn().mockImplementation(() => ({ Authorization: `Bearer ${token}` }));
    const onUnauthorized = vi.fn().mockImplementation(async () => {
      token = 'fresh-token';
      return true;
    });
    const client = createApiClient({ baseUrl: 'https://api.test', getAuthHeaders, onUnauthorized });

    await client.get('/thing');

    const secondCallHeaders = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].headers as Record<string, string>;
    expect(secondCallHeaders.Authorization).toBe('Bearer fresh-token');
  });
});
