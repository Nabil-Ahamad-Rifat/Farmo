import { useEffect } from 'react';
import { router } from 'expo-router';
import { useSession } from '@/src/context/AuthContext';

/**
 * Money reports and settings are for the owner only. A manager who reaches one
 * (e.g. from an old link) is sent back to Home, like the web's requireOwnerPage.
 * Returns whether the screen may render.
 */
export function useOwnerOnly(): boolean {
  const { isOwner } = useSession();
  useEffect(() => {
    if (!isOwner) router.replace('/');
  }, [isOwner]);
  return isOwner;
}
