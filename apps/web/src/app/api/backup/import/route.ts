import { z } from 'zod';
import { withOwner } from '@/lib/middleware/withAuth';
import { rateLimitUser, tooManyRequests } from '@/lib/rate-limit';
import { MAX_PART_CHARS, RestoreError, clearStage, loadStaged, newJobId, restoreBackup, stagePart } from '@/lib/backup';

// Restore a backup into this farm (owner only), in three steps because Vercel
// caps a request at 4.5 MB:
//   { action: 'start' }                           -> { jobId }
//   { action: 'part', jobId, part, data }         each part ≤ 3.5 MB of the decrypted JSON text
//   { action: 'commit', jobId, parts }            replaces the farm's records, keeps logins
export const maxDuration = 60;

const jobId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid restore id');
const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('part'), jobId, part: z.number().int().min(0).max(10_000), data: z.string().min(1).max(MAX_PART_CHARS) }),
  z.object({ action: z.literal('commit'), jobId, parts: z.number().int().min(1).max(10_000) }),
]);

export const POST = withOwner(async (req, { tenantId, userId }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  const input = parsed.data;
  try {
    if (input.action === 'start') {
      if (!(await rateLimitUser(userId, 'backup-import', 10, 60 * 60 * 1000))) return tooManyRequests('Too many restores. Please try again later.');
      // Only one restore at a time per farm: drop any earlier unfinished upload.
      await clearStage(tenantId);
      return Response.json({ jobId: newJobId() });
    }
    if (input.action === 'part') {
      if (!(await rateLimitUser(userId, 'backup-part', 2000, 60 * 60 * 1000))) return tooManyRequests();
      await stagePart(tenantId, input.jobId, input.part, input.data);
      return Response.json({ ok: true });
    }
    const backup = await loadStaged(tenantId, input.jobId, input.parts);
    const result = await restoreBackup(tenantId, userId, backup);
    await clearStage(tenantId, input.jobId);
    return Response.json(result);
  } catch (err) {
    if (err instanceof RestoreError) return Response.json({ error: err.message }, { status: 400 });
    console.error('Backup import failed:', err);
    return Response.json({ error: 'The restore could not be completed' }, { status: 500 });
  }
});
