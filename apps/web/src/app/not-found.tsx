import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/ui/Brand';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 font-sans">
      <div className="w-full max-w-md rounded-card border border-line bg-white p-8 text-center shadow-card">
        <div className="flex justify-center">
          <BrandMark size="lg" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Error 404</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <ButtonLink href="/dashboard" className="mt-6">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
