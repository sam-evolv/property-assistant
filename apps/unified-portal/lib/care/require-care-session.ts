/**
 * requireCareSession: single auth boundary for installer-side Care routes.
 *
 * Background. Pre-batch, every Care route under app/api/care/* spun up its own
 * service-role Supabase client and queried `installations` by `id` with no
 * tenant filter. A valid admin JWT for tenant A could pass installation_id
 * for tenant B and the route served the data. This helper closes that gap
 * by centralising session resolution and installation scoping in one
 * auditable file.
 *
 * Scope. Installer-side routes only (admin session via cookies). Homeowner-
 * side routes (chat, conversations, telemetry, third-party, content,
 * manifest, access) have a fundamentally different auth model (QR-code
 * entry, no admin login) and are out of scope for Batch 1. See the Batch 2
 * follow-up issue.
 *
 * Trade-off documented for PR review. The session is resolved with a
 * user-scoped Supabase client built from the request cookies. This is the
 * primary auth boundary and uses the user's actual JWT. Subsequent queries
 * (installation lookup, route business logic) use a service-role client
 * scoped by mandatory tenant filters set inside this helper. The reason is
 * that Care tables currently carry only service-role RLS policies (audit
 * finding C015); migrating Care RLS to user-aware policies is a separate
 * batch. The net effect: service-role usage drops from ~15 unauditable
 * call sites to one file with a verified session always in hand.
 */

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getServerSession } from '@/lib/supabase-server';
import type { AdminSession } from '@/lib/supabase-server';

type CareAuthErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'cross_tenant_conversation';

export class CareAuthError extends Error {
  constructor(public code: CareAuthErrorCode) {
    super(code);
    this.name = 'CareAuthError';
  }
}

export interface CareInstallation {
  id: string;
  tenant_id: string;
  development_id: string | null;
  system_type: string;
  system_model: string | null;
  serial_number: string | null;
  installation_date: string | null;
  warranty_expiry: string | null;
  homeowner_email: string | null;
  adoption_status: string | null;
  adopted_at: string | null;
  notes: string | null;
  component_specs: Record<string, unknown> | null;
  performance_baseline: Record<string, unknown> | null;
  telemetry_source: string | null;
  telemetry_api_key: string | null;
  qr_code: string | null;
  handover_date: string | null;
  is_active: boolean | null;
  access_code: string | null;
  [key: string]: unknown;
}

export interface CareSessionContext {
  supabase: SupabaseClient;
  session: AdminSession;
  installation: CareInstallation;
}

export interface CareTenantContext {
  supabase: SupabaseClient;
  session: AdminSession;
}

/**
 * Resolve and verify an installer admin session. Used by routes that don't
 * carry an installation id (lists, dashboard stats, intelligence chat). The
 * returned supabase client is service-role scoped; the caller MUST filter
 * by session.tenantId on every query.
 */
export async function requireCareTenantSession(): Promise<CareTenantContext> {
  const session = await getServerSession();

  if (!session) {
    throw new CareAuthError('unauthenticated');
  }

  if (!session.tenantId) {
    throw new CareAuthError('forbidden');
  }

  // Touch the user-scoped client to confirm the JWT in cookies is valid
  // and not stale. If auth.getUser() rejects, this throws back as
  // unauthenticated rather than serving data on a half-revoked session.
  const userScoped = createServerComponentClient({ cookies });
  const { data: { user }, error: userErr } = await userScoped.auth.getUser();
  if (userErr || !user) {
    throw new CareAuthError('unauthenticated');
  }

  return {
    supabase: getSupabaseAdmin(),
    session,
  };
}

/**
 * Resolve and verify an installer admin session, then load the requested
 * installation under that session's tenant. If the installation does not
 * exist or belongs to a different tenant, throw not_found (deliberately
 * ambiguous; do not differentiate from absence in the response).
 *
 * If a conversationId is provided, verify it belongs to the same
 * installation. This is the primary defence against the conversation
 * context-bleed P0.
 */
export async function requireCareSession(opts: {
  installationId: string;
  conversationId?: string;
}): Promise<CareSessionContext> {
  const { installationId, conversationId } = opts;

  if (!installationId) {
    throw new CareAuthError('not_found');
  }

  const { supabase, session } = await requireCareTenantSession();

  const { data: installation, error } = await supabase
    .from('installations')
    .select('*')
    .eq('id', installationId)
    .eq('tenant_id', session.tenantId)
    .maybeSingle();

  if (error || !installation) {
    throw new CareAuthError('not_found');
  }

  if (conversationId) {
    const { data: convo, error: convoErr } = await supabase
      .from('care_conversations')
      .select('id, installation_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (convoErr || !convo) {
      throw new CareAuthError('not_found');
    }

    if (convo.installation_id !== installationId) {
      throw new CareAuthError('cross_tenant_conversation');
    }
  }

  return {
    supabase,
    session,
    installation: installation as CareInstallation,
  };
}

/**
 * Map a CareAuthError to a NextResponse. Returns 401 for unauthenticated,
 * 403 for forbidden (authenticated but no tenant claim), and 404 for both
 * not_found and cross_tenant_conversation. The two 404 cases must look
 * identical from outside; differentiating them would leak existence of
 * other tenants' rows.
 */
export function careAuthErrorToResponse(err: CareAuthError): NextResponse {
  if (err.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  if (err.code === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/**
 * Convenience wrapper for the common try/catch pattern. Lets a route body
 * stay focused on business logic.
 */
export async function withCareSession<T>(
  opts: { installationId: string; conversationId?: string },
  handler: (ctx: CareSessionContext) => Promise<NextResponse | T>,
): Promise<NextResponse | T> {
  try {
    const ctx = await requireCareSession(opts);
    return await handler(ctx);
  } catch (err) {
    if (err instanceof CareAuthError) {
      return careAuthErrorToResponse(err);
    }
    throw err;
  }
}

export async function withCareTenantSession<T>(
  handler: (ctx: CareTenantContext) => Promise<NextResponse | T>,
): Promise<NextResponse | T> {
  try {
    const ctx = await requireCareTenantSession();
    return await handler(ctx);
  } catch (err) {
    if (err instanceof CareAuthError) {
      return careAuthErrorToResponse(err);
    }
    throw err;
  }
}
