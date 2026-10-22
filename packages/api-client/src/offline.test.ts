import { describe, it, expect } from 'vitest';
import { ApiError } from './errors';
import { describeEntry, isNetworkError, isQueueablePost, isQueued, replayOutbox, type OutboxEntry } from './offline';

function entry(id: string, createdAt: string, status: OutboxEntry['status'] = 'pending'): OutboxEntry {
  return {
    id,
    userId: 'u1',
    method: 'POST',
    path: '/api/sales',
    body: { amount: 100 },
    idempotencyKey: `k-${id}`,
    label: 'Sale',
    createdAt,
    attempts: 0,
    status,
    lastError: null,
  };
}

describe('isQueueablePost', () => {
  it('accepts the supported create routes', () => {
    for (const p of [
      '/api/sales',
      '/api/customers/abc/payments',
      '/api/suppliers/abc/payments',
      '/api/expenses',
      '/api/income',
      '/api/feed',
      '/api/feed/usage',
      '/api/cows',
      '/api/cows/abc/events',
      '/api/employees/abc/payments',
      '/api/employees/abc/absences',
      '/api/employees/abc/work',
    ]) {
      expect(isQueueablePost(p)).toBe(true);
    }
  });

  it('rejects everything else (edits, auth, team, nested ids)', () => {
    for (const p of ['/api/sales/abc', '/api/auth/login', '/api/team', '/api/cows/abc/photos', '/api/customers', '/api/employees/abc/leave', '/api/cows/abc']) {
      expect(isQueueablePost(p)).toBe(false);
    }
  });
});

describe('isNetworkError / isQueued', () => {
  it('only status 0 counts as a network error', () => {
    expect(isNetworkError(new ApiError('offline', 0))).toBe(true);
    expect(isNetworkError(new ApiError('bad', 400))).toBe(false);
    expect(isNetworkError(new Error('x'))).toBe(false);
  });

  it('recognises the queued result', () => {
    expect(isQueued({ __queued: true, outboxId: 'a' })).toBe(true);
    expect(isQueued({ id: 'a' })).toBe(false);
    expect(isQueued(null)).toBe(false);
  });
});

describe('replayOutbox', () => {
  it('uploads oldest first and skips already-failed entries', async () => {
    const sent: string[] = [];
    const out = await replayOutbox([entry('b', '2026-10-20T10:02:00Z'), entry('x', '2026-10-20T09:00:00Z', 'failed'), entry('a', '2026-10-20T10:01:00Z')], async (e) => {
      sent.push(e.id);
    });
    expect(sent).toEqual(['a', 'b']);
    expect(out).toEqual({ uploaded: ['a', 'b'], failed: [], stopped: false });
  });

  it('stops on a network error and keeps the rest pending', async () => {
    const out = await replayOutbox([entry('a', '1'), entry('b', '2'), entry('c', '3')], async (e) => {
      if (e.id === 'b') throw new ApiError('offline', 0);
    });
    expect(out).toEqual({ uploaded: ['a'], failed: [], stopped: true });
  });

  it('stops on a server error or expired login, marks 4xx refusals failed and continues', async () => {
    const refused = await replayOutbox([entry('a', '1'), entry('b', '2')], async (e) => {
      if (e.id === 'a') throw new ApiError('Amount must be more than 0', 400);
    });
    expect(refused).toEqual({ uploaded: ['b'], failed: [{ id: 'a', error: 'Amount must be more than 0' }], stopped: false });

    for (const status of [500, 503, 401, 429]) {
      const out = await replayOutbox([entry('a', '1'), entry('b', '2')], async () => {
        throw new ApiError('nope', status);
      });
      expect(out).toEqual({ uploaded: [], failed: [], stopped: true });
    }
  });
});

describe('describeEntry', () => {
  it('names the entry for the Settings panel', () => {
    expect(describeEntry('/api/sales', { customerName: 'Rahim Dairy', amount: 840 })).toBe('Sale · Rahim Dairy ৳840');
    expect(describeEntry('/api/customers/x/payments', { amount: '500' })).toBe('Payment received ৳500');
    expect(describeEntry('/api/employees/x/payments', { amount: 1000 })).toBe('Worker paid ৳1000');
    expect(describeEntry('/api/feed/usage', { quantity: 5 })).toBe('Feed used · 5 kg');
  });
});
