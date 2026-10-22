import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDueSoon, listAnimals, suggestAnimalId } from '@/lib/animals';
import CowManager from '@/components/CowManager';

export default async function CowsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const [cows, suggestedId, dueSoon] = await Promise.all([
    listAnimals(session.tenantId),
    suggestAnimalId(session.tenantId),
    getDueSoon(session.tenantId),
  ]);

  return <CowManager initialCows={cows} suggestedId={suggestedId} dueSoon={dueSoon} />;
}
