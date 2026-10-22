"use client";

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

/** Sign-out button; `dark` for the navy sidebar and menu. */
export default function LogoutButton({ dark = false }: { dark?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors ${
        dark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-red-600 hover:bg-red-50 hover:text-red-700'
      }`}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sign out
    </button>
  );
}
