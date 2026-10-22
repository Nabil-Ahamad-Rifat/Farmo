import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { getAnimalDetail, suggestAnimalId } from '@/lib/animals';
import AnimalDetailView from '@/components/AnimalDetailView';

export default async function AnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const [animal, herd, suggestedId] = await Promise.all([
    getAnimalDetail(session.tenantId, id),
    db.cow.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, tagNumber: true, name: true, gender: true },
      orderBy: { tagNumber: 'asc' },
    }),
    suggestAnimalId(session.tenantId),
  ]);
  if (!animal) notFound();
  // Animals added before gender existed have none; they may still be mothers.
  const mothers = herd.filter((c) => c.gender !== 'male').map(({ id, tagNumber, name }) => ({ id, tagNumber, name }));

  return <AnimalDetailView animal={animal} mothers={mothers} suggestedId={suggestedId} />;
}
