"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const EVERY_MS = 60_000;
const MIN_GAP_MS = 15_000;

/**
 * Keeps dashboard pages in step with the phone app: re-fetches the server
 * components (router.refresh keeps form and dialog state) when the tab comes
 * back into view, and every 60 s while it is visible. Skipped while a dialog is
 * open or the user is typing, and never more than once per 15 s.
 */
export default function AutoRefresh() {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    function refresh() {
      if (document.hidden) return;
      if (Date.now() - last.current < MIN_GAP_MS) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
      last.current = Date.now();
      router.refresh();
    }
    last.current = Date.now();
    const timer = setInterval(refresh, EVERY_MS);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [router]);

  return null;
}
