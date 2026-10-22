import { withAuth } from '@/lib/middleware/withAuth';
import { listAnimalCosts } from '@/lib/animals';

// GET /api/expenses/animal-care: every animal record with a cost (vet,
// medicine, vaccine, semen...), newest first. The web Expenses page lists
// these as "Animal care"; the mobile app reads them here. Managers see the
// Expenses page too, so this is not owner-only.
export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    return Response.json(await listAnimalCosts(tenantId));
  } catch (err: unknown) {
    console.error('Error loading animal care costs:', err);
    return Response.json({ error: 'Failed to load animal care costs' }, { status: 500 });
  }
});
