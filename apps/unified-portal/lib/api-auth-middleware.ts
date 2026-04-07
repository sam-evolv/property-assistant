/**
 * Centralized API Authentication Middleware
 *
 * USAGE:
 *   import { withAuth } from '@/lib/api-auth-middleware';
 *
 *   // Protected route (default — requires any authenticated user):
 *   export const GET = withAuth(async (req, { session }) => {
 *     // session is guaranteed to be a valid AdminSession
 *     return NextResponse.json({ tenantId: session.tenantId });
 *   });
 *
 *   // Protected route with specific roles:
 *   export const POST = withAuth(async (req, { session }) => {
 *     return NextResponse.json({ ok: true });
 *   }, { roles: ['developer', 'admin', 'super_admin'] });
 *
 *   // Public route (opt-out of auth):
 *   export const GET = withAuth(async (req) => {
 *     return NextResponse.json({ status: 'ok' });
 *   }, { public: true });
 *
 * HOW TO MARK A ROUTE AS PUBLIC:
 *   Pass { public: true } as the second argument to withAuth(). This skips
 *   all session and role checks, passing the request straight through.
 *
 * WHY OPT-OUT RATHER THAN OPT-IN:
 *   With opt-in auth, every new route is unauthenticated by default. Developers
 *   must remember to add auth — and when they forget, the route ships wide open.
 *   The audit found 10 such regressions. With opt-out (withAuth wraps every
 *   route, auth is on by default), a developer must explicitly declare
 *   { public: true } to remove protection. This makes unauthenticated routes
 *   visible in code review and impossible to create by accident.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireRole as requireRoleFromServer } from '@/lib/supabase-server';
import type { AdminRole, AdminSession } from '@/lib/types';

export interface AuthContext {
  session: AdminSession;
}

export interface WithAuthOptions {
  /** If true, skip all authentication checks. Defaults to false. */
  public?: boolean;
  /** If provided, the user must have one of these roles. */
  roles?: AdminRole[];
}

type AuthenticatedHandler = (
  req: NextRequest,
  ctx: AuthContext,
  ...args: any[]
) => Promise<NextResponse> | NextResponse;

type PublicHandler = (
  req: NextRequest,
  ...args: any[]
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js API route handler with centralized authentication.
 *
 * By default, all routes require a valid Supabase session. Pass
 * `{ public: true }` to opt out, or `{ roles: [...] }` to restrict
 * to specific admin roles.
 */
export function withAuth(
  handler: AuthenticatedHandler | PublicHandler,
  options: WithAuthOptions = {},
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // Public routes bypass auth entirely
    if (options.public) {
      return (handler as PublicHandler)(req, ...args);
    }

    try {
      let session: AdminSession;

      if (options.roles && options.roles.length > 0) {
        session = await requireRoleFromServer(options.roles);
      } else {
        session = await requireSession();
      }

      return (handler as AuthenticatedHandler)(req, { session }, ...args);
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 },
        );
      }
      if (error.message === 'FORBIDDEN') {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 },
        );
      }
      throw error;
    }
  };
}
