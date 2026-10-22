let counter = 0;

// A key stable across retries of the *same* logical create action (e.g. one
// open-modal submission), so a slow network + a "try again" tap can't create
// a duplicate record — the matching server route wraps its create in
// withIdempotency() (apps/web/src/lib/idempotency.ts) and replays the cached
// response for a repeated key instead of re-running the write. Generate a
// fresh one each time a create form is opened (not per fetch attempt).
export function generateIdempotencyKey(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
