"use client";

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Development machine without email: the server returns the link to show here.
  const [devResetUrl, setDevResetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send reset link');
      setDevResetUrl(typeof data.devResetUrl === 'string' ? data.devResetUrl : '');
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>

        {submitted && devResetUrl ? (
          <div className="mt-8 text-center">
            <h1 className="text-xl font-bold text-ink">Set a new password</h1>
            <p className="mt-2 text-sm text-slate-500">
              Email is not set up on this computer, so no email was sent. Use this link for{' '}
              <span className="font-medium text-ink">{email}</span> (valid for 30 minutes):
            </p>
            <a
              href={devResetUrl}
              className="mt-5 inline-flex w-full items-center justify-center h-11 rounded-control bg-ink px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700"
            >
              Set new password →
            </a>
            <Link href="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : submitted ? (
          /* Success state */
          <div className="mt-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 border border-brand-200">
              <CheckCircle2 className="h-7 w-7 text-brand-700" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-ink">Check your email</h1>
            <p className="mt-2 text-sm text-slate-500">
              If <span className="font-medium text-ink">{email}</span> is registered, you&apos;ll receive a password reset link within a few minutes.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Don&apos;t see it? Check your spam folder. The link expires in 30 minutes.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          /* Form state */
          <>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">Forgot your password?</h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mt-4 rounded-control border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    placeholder="owner@farm.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-control border border-line bg-white pl-10 pr-3.5 py-2.5 text-base text-ink shadow-sm placeholder:text-slate-500 transition-colors focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 sm:text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 h-11 rounded-control bg-ink px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700 disabled:opacity-50 mt-2"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Remember your password?{' '}
              <Link href="/login" className="font-semibold text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </AuthShell>
  );
}
