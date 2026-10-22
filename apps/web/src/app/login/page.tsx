"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState, Suspense } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { ArrowRight } from 'lucide-react';

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_not_configured: 'Google sign-in is not configured yet.',
  google_token_failed: 'Google authentication failed. Please try again.',
  google_no_email: 'Could not retrieve a verified email from Google account.',
  google_server_error: 'An error occurred during Google sign-in.',
  google_invalid_state: 'Your sign-in session expired. Please try again.',
  google_rate_limited: 'Too many sign-in attempts. Please wait a moment and try again.',
  google_password_account: 'This email already has a password — sign in with it.',
};

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(oauthError ? (GOOGLE_ERROR_MESSAGES[oauthError] ?? 'Sign-in error.') : '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to your farm management account.</p>

      {error && (
        <div className="mt-4 rounded-control border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Google Sign-In Button */}
      <a
        href="/api/auth/google"
        className="mt-6 flex w-full items-center justify-center gap-3 h-11 rounded-control border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-slate-50"
      >
        <GoogleIcon />
        Continue with Google
      </a>

      {/* Divider */}
      <div className="relative my-5 flex items-center">
        <div className="flex-grow border-t border-line" />
        <span className="mx-3 flex-shrink text-xs font-medium text-slate-500">or sign in with email</span>
        <div className="flex-grow border-t border-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-slate-700">
            Email Address
          </label>
          <input
            className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-base text-ink shadow-sm placeholder:text-slate-500 transition-colors focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 sm:text-sm"
            id="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="owner@farm.com"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-slate-700">Password</label>
            <Link href="/forgot-password" className="text-[11px] font-semibold text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-base text-ink shadow-sm placeholder:text-slate-500 transition-colors focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 sm:text-sm"
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>

        <button
          className="flex w-full items-center justify-center gap-2 h-11 rounded-control bg-ink px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700 disabled:opacity-50 mt-2"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Continue to Dashboard'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Create farm account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
        <Suspense fallback={<div className="mt-8 text-slate-500 text-sm animate-pulse">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </AuthShell>
  );
}
