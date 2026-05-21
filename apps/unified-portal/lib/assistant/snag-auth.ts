/**
 * Tenant verification for Assistant V2 Sprint 2 snag routes.
 *
 * Builder-side callers always come through a Supabase session cookie.
 * Unlike Sprint 1's media-auth (which also handles homeowner x-qr-token
 * paths), there is no token-based path here. The flow is:
 *
 *   1. Read the Supabase auth user from the session cookie.
 *   2. Load the caller's active site_team_members row.
 *   3. For snagger_external, also enforce expires_at.
 *
 * tenant_id, role, and development_ids always come from site_team_members,
 * never from the client. The caller can supply a development_id in the
 * request body for resource-scoped routes, but it is then cross-checked
 * against the verified membership and rejected with 403 on mismatch.
 *
 * Routes use the helpers in this file:
 *   - resolveSnagAuth(request)               basic identity resolution
 *   - assertCanAccessDevelopment(auth, id)   per-route resource check
 *   - assertCanAccessTenant(auth, id)        per-route resource check
 *   - assertIsAdmin(auth)                    admin-only route guard
 *   - snagAuthErrorToResponse(err)           uniform error mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';

export type SnagRole = 'admin' | 'site_team' | 'snagger_external';

export interface SnagAuthContext {
  userId: string;
  email: string;
  tenantId: string;
  role: SnagRole;
  developmentIds: string[] | null;
  isAdmin: boolean;
  membershipId: string;
  expiresAt: string | null;
}

export type SnagAuthErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'expired';

export class SnagAuthError extends Error {
  constructor(public code: SnagAuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'SnagAuthError';
  }
}

interface SiteTeamMemberRow {
  id: string;
  tenant_id: string;
  user_id: string;
  role: SnagRole;
  development_ids: string[] | null;
  active: boolean;
  expires_at: string | null;
}

/**
 * Resolve the caller's identity and membership. Returns the first active
 * site_team_members row for the authenticated user, after enforcing
 * snagger_external expiry. Throws SnagAuthError on any failure.
 *
 * Multi-tenant membership is theoretically possible but not exercised in
 * Sprint 2. If a user belongs to multiple tenants, the first active row
 * wins; downstream routes can still apply tenant-specific checks via
 * assertCanAccessTenant.
 *
 * The `_request` parameter is unused: identity comes from the Supabase
 * session cookie via createServerSupabaseClient. It is optional so the
 * same function can be called from server components (which have no
 * NextRequest) without a casting workaround.
 */
export async function resolveSnagAuth(_request?: NextRequest): Promise<SnagAuthContext> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();

  if (userErr || !user?.id || !user.email) {
    throw new SnagAuthError('unauthenticated');
  }

  const admin = getSupabaseAdmin();
  const { data: rows, error: memErr } = await admin
    .from('site_team_members')
    .select('id, tenant_id, user_id, role, development_ids, active, expires_at')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('invited_at', { ascending: true });

  if (memErr) {
    console.error('[snag-auth] membership_lookup_failed reason=%s', memErr.message);
    throw new SnagAuthError('forbidden');
  }
  if (!rows || rows.length === 0) {
    throw new SnagAuthError('forbidden');
  }

  const now = Date.now();
  const usable = (rows as SiteTeamMemberRow[]).find((r) => {
    if (r.role === 'snagger_external' && r.expires_at) {
      return new Date(r.expires_at).getTime() > now;
    }
    return true;
  });

  if (!usable) {
    throw new SnagAuthError('expired');
  }

  return {
    userId: usable.user_id,
    email: user.email,
    tenantId: usable.tenant_id,
    role: usable.role,
    developmentIds: usable.development_ids,
    isAdmin: usable.role === 'admin',
    membershipId: usable.id,
    expiresAt: usable.expires_at,
  };
}

export function assertCanAccessTenant(auth: SnagAuthContext, tenantId: string): void {
  if (auth.tenantId !== tenantId) {
    throw new SnagAuthError('forbidden');
  }
}

/**
 * Verify the caller's membership permits access to the supplied
 * development. admin and site_team see all developments in their tenant.
 * snagger_external is scoped to the development_ids array.
 *
 * This does NOT confirm tenant_id of the development; the caller must
 * have already established that the development belongs to auth.tenantId
 * via assertCanAccessTenant or an explicit tenant lookup.
 */
export function assertCanAccessDevelopment(
  auth: SnagAuthContext,
  developmentId: string,
): void {
  if (auth.role === 'admin' || auth.role === 'site_team') {
    return;
  }
  if (auth.role === 'snagger_external') {
    const allowed = Array.isArray(auth.developmentIds) && auth.developmentIds.includes(developmentId);
    if (!allowed) {
      throw new SnagAuthError('forbidden');
    }
    return;
  }
  throw new SnagAuthError('forbidden');
}

export function assertIsAdmin(auth: SnagAuthContext): void {
  if (!auth.isAdmin) {
    throw new SnagAuthError('forbidden');
  }
}

export function snagAuthErrorToResponse(err: SnagAuthError): NextResponse {
  if (err.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (err.code === 'expired') {
    return NextResponse.json({ error: 'Membership expired' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * Return a fresh 404 NextResponse when the feature flag is off. Routes
 * call this as the very first line so the surface area of the disabled
 * feature is exactly zero (no parse, no auth, no DB).
 */
export function snagFeatureDisabledResponse(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
