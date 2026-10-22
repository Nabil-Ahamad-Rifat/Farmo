"use client";

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-8 text-center">
        <p className="text-red-400 text-sm">Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-brand-700 hover:underline text-sm font-semibold">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <>
      {success ? (
        <div className="mt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 border border-brand-200">
            <CheckCircle2 className="h-7 w-7 text-brand-700" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-ink">Password updated!</h1>
          <p className="mt-2 text-sm text-slate-500">Redirecting you to sign in...</p>
        </div>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a strong password for your farm account.</p>

          {error && (
            <div className="mt-4 rounded-control border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 pr-10 text-base text-ink shadow-sm placeholder:text-slate-400 sm:text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                required
                placeholder="Repeat your new password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className={`w-full rounded-control border bg-white px-3.5 py-2.5 text-base text-ink shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-colors sm:text-sm ${
                  form.confirmPassword && form.confirmPassword !== form.newPassword
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                    : 'border-line focus:border-brand-600 focus:ring-brand-600/10'
                }`}
              />
              {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                <p className="mt-1 text-[11px] text-red-400">Passwords don&apos;t match</p>
              )}
            </div>

            {/* Password strength indicator */}
            {form.newPassword && (
              <div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        form.newPassword.length >= i * 3
                          ? form.newPassword.length < 8
                            ? 'bg-amber-400'
                            : 'bg-brand-400'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {form.newPassword.length < 8
                    ? `${8 - form.newPassword.length} more character${8 - form.newPassword.length !== 1 ? 's' : ''} needed`
                    : '✓ Strong enough'}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || form.newPassword !== form.confirmPassword || form.newPassword.length < 8}
              className="flex w-full items-center justify-center gap-2 h-11 rounded-control bg-ink px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700 disabled:opacity-50 mt-2"
            >
              {loading ? 'Updating...' : 'Update Password'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
        <Suspense fallback={<div className="mt-8 text-slate-500 text-sm">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </AuthShell>
  );
}
