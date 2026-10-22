import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { currentUser, isOwner } from '@/lib/auth/session';
import { rateLimitUser } from '@/lib/rate-limit';
import { isObjectId } from '@/lib/receivables';

export { isObjectId };

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence for cookie sessions: a state-changing request must come from a
 * page on this site (Origin, or Referer when Origin is missing, matches the
 * request's own host or NEXT_PUBLIC_APP_URL). SameSite=Lax already blocks most
 * cross-site posts; this closes the rest. Bearer-token clients (the phone app)
 * are not exposed to CSRF and skip the check.
 */
export function sameOrigin(req: NextRequest): boolean {
  const source = req.headers.get('origin') ?? req.headers.get('referer');
  if (!source || source === 'null') return false;
  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    return false;
  }
  const allowed = new Set<string>();
  const host = req.headers.get('host');
  if (host) allowed.add(host);
  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost) allowed.add(forwardedHost.split(',')[0].trim());
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host);
  } catch {
    // An invalid NEXT_PUBLIC_APP_URL just isn't added.
  }
  return allowed.has(sourceHost);
}

// Generous cap on writes per user, so a stolen session or a runaway client
// can't flood the database: 600 changes per 15 minutes.
const WRITE_LIMIT = 600;
const WRITE_WINDOW_MS = 15 * 60 * 1000;

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  name: string;
}

export function withAuth<T = unknown>(
  handler: (req: NextRequest, ctx: AuthContext, routeContext: T) => Promise<Response>
) {
  return async (req: NextRequest, routeContext: T) => {
    const authHeader = req.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearer || req.cookies.get('token')?.value;

    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await currentUser(verifyToken(token));
    if (!payload) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (MUTATING.has(req.method)) {
      if (!bearer && !sameOrigin(req)) {
        return Response.json({ error: 'This request did not come from the Farm Manager app' }, { status: 403 });
      }
      if (!(await rateLimitUser(payload.userId, 'write', WRITE_LIMIT, WRITE_WINDOW_MS))) {
        return Response.json({ error: 'Too many changes in a short time. Please wait a few minutes.' }, { status: 429 });
      }
    }

    return handler(req, payload, routeContext);
  };
}

export async function getIdFromParams(routeContext: unknown, req: NextRequest): Promise<string | null> {
  if (routeContext && typeof routeContext === 'object' && 'params' in routeContext) {
    const resolved = await (routeContext as { params?: Promise<{ id?: string }> }).params;
    if (resolved?.id) return resolved.id;
  }

  // Parse path segments, e.g. /api/employees/clx123/salary -> 'clx123'
  const segments = req.nextUrl.pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  if (apiIndex !== -1 && segments.length >= apiIndex + 3) {
    // segments[apiIndex+1] = 'employees', segments[apiIndex+2] = employeeId
    return segments[apiIndex + 2];
  }

  const last = segments.pop();
  if (last === 'salary' || last === 'usage') {
    return segments.pop() || null;
  }
  return last || null;
}

/** Like withAuth, for routes only the farm owner may use (money reports, settings, team). Managers get 403. */
export function withOwner<T = unknown>(
  handler: (req: NextRequest, ctx: AuthContext, routeContext: T) => Promise<Response>
) {
  return withAuth<T>(async (req, ctx, routeContext) => {
    if (!isOwner(ctx.role)) {
      return Response.json({ error: 'Only the farm owner can see this' }, { status: 403 });
    }
    return handler(req, ctx, routeContext);
  });
}
