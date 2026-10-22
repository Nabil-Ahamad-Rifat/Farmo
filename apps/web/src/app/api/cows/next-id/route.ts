import { withAuth } from '@/lib/middleware/withAuth';
import { suggestAnimalId } from '@/lib/animals';

// GET /api/cows/next-id -> { tagNumber: "C-004" }, the suggested Cow ID for a new animal.
export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    return Response.json({ tagNumber: await suggestAnimalId(tenantId) });
  } catch (err: unknown) {
    console.error('Error suggesting animal ID:', err);
    return Response.json({ error: 'Failed to suggest an ID' }, { status: 500 });
  }
});
