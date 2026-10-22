import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getWorkerDetail } from '@/lib/payroll';
import WorkerDetailView from '@/components/WorkerDetailView';

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const worker = await getWorkerDetail(session.tenantId, id);
  if (!worker) notFound();

  return <WorkerDetailView worker={worker} />;
}
