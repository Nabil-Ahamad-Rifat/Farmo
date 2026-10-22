import { mobileApiClient } from '@/src/lib/apiClient';

interface VersionInfo {
  minSupportedVersion: string;
  latestVersion: string;
  forceUpdateBelow: string;
}

/** Compares dot-separated numeric versions ("1.2.0" < "1.10.0"). Returns true if `current` is strictly below `minimum`. */
export function isVersionBelow(current: string, minimum: string): boolean {
  const a = current.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** Hits the unauthenticated /api/meta/version endpoint. Fails open (returns null) on any error — a backend hiccup shouldn't lock users out of the app. */
export async function fetchVersionInfo(): Promise<VersionInfo | null> {
  try {
    return await mobileApiClient.get<VersionInfo>('/api/meta/version');
  } catch {
    return null;
  }
}
