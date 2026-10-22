import { use, createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { AuthUser } from '@farm/shared-types';
import { mobileApiClient, setSessionListener } from '@/src/lib/apiClient';
import { useStorageState } from '@/src/lib/useStorageState';
import { cacheClear } from '@/src/lib/cache';
import { clearOutbox } from '@/src/lib/outbox';

interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Managers do the daily work but can't see money reports (same rule as web's isOwner). */
  isOwner: boolean;
  /** The farm (tenant) name for the header; "Farm Manager" until loaded. */
  farmName: string;
  refreshFarm: () => Promise<void>;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, tenantName?: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  createRanch: (ranchName: string) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useSession must be used within an <AuthProvider>');
  }
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [[isAccessLoading], setAccessToken] = useStorageState('accessToken');
  const [[isRefreshLoading, refreshToken], setRefreshToken] = useStorageState('refreshToken');
  const [[isUserLoading, userJson], setUserJson] = useStorageState('user');

  const isLoading = isAccessLoading || isRefreshLoading || isUserLoading;
  const user: AuthUser | null = useMemo(() => {
    if (!userJson) return null;
    try {
      return JSON.parse(userJson) as AuthUser;
    } catch {
      return null;
    }
  }, [userJson]);

  function persistSession(session: AuthSession) {
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    setUserJson(JSON.stringify(session.user));
  }

  function clearSession() {
    setAccessToken(null);
    setRefreshToken(null);
    setUserJson(null);
  }

  const [farmName, setFarmName] = useState('Farm Manager');
  const refreshFarm = useCallback(async () => {
    try {
      const s = await mobileApiClient.get<{ tenantName?: string }>('/api/settings');
      if (s.tenantName) setFarmName(s.tenantName);
    } catch {
      // Header falls back to "Farm Manager"; nothing else depends on it.
    }
  }, []);

  // Load the farm name for each signed-in user (and after switching ranch).
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    // The name is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshFarm();
  }, [userId, refreshFarm]);

  // apiClient refreshes the access token itself (outside of any handler
  // here) when a request 401s — this is how that lands back in React state:
  // a successful refresh updates just the tokens, a failed one (refresh
  // token expired/revoked) clears the whole session so Stack.Protected in
  // app/_layout.tsx redirects to (auth).
  useEffect(() => {
    setSessionListener((tokens) => {
      if (tokens) {
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
      } else {
        clearSession();
      }
    });
    return () => setSessionListener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextValue = {
    user,
    isOwner: user?.role !== 'manager',
    farmName,
    refreshFarm,
    isLoading,

    async signIn(email, password) {
      const session = await mobileApiClient.post<AuthSession>(
        '/api/auth/login',
        { email, password },
        'Invalid email or password'
      );
      persistSession(session);
    },

    async signUp(name, email, password, tenantName) {
      const session = await mobileApiClient.post<AuthSession>(
        '/api/auth/register',
        { name, email, password, tenantName },
        'Could not create your account'
      );
      persistSession(session);
    },

    async signInWithGoogle(idToken) {
      const session = await mobileApiClient.post<AuthSession>(
        '/api/auth/google/mobile',
        { idToken },
        'Google sign-in failed'
      );
      persistSession(session);
    },

    async createRanch(ranchName) {
      // Reassigns the signed-in user to a brand-new tenant workspace (see
      // apps/web/src/app/dashboard/ranches/page.tsx) — matches web's
      // "Create a New Ranch" behavior exactly, including that it switches
      // the account away from whatever tenant it was on before.
      const session = await mobileApiClient.post<AuthSession>(
        '/api/ranches',
        { ranchName },
        'Unable to create ranch'
      );
      persistSession(session);
      // Same user id, so the effect above won't reload the name.
      setFarmName(ranchName.trim() || 'Farm Manager');
    },

    async deleteAccount(password) {
      // Unlike signOut, a failure here must NOT clear local state — the
      // account still exists server-side (e.g. wrong password), so silently
      // logging the user out would just hide the error.
      await mobileApiClient.post('/api/auth/account/delete', { password }, 'Unable to delete account');
      // The account is gone: drop its saved data and anything waiting to upload.
      if (user) await Promise.all([cacheClear(user.id), clearOutbox(user.id)]);
      clearSession();
    },

    async signOut() {
      try {
        await mobileApiClient.post('/api/auth/logout', { refreshToken });
      } catch {
        // Best-effort server-side revoke — always clear local state below
        // even if the network call fails (e.g. offline).
      }
      // Saved offline copies are private to this user. Entries still waiting to
      // upload are kept and go up the next time this user signs in.
      if (user) await cacheClear(user.id);
      clearSession();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
