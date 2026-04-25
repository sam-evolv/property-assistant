import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session 15 — GET /api/agent/intelligence/whoami.
 *
 * Operator-facing diagnostic endpoint. Returns the resolved agent identity
 * for the *current* session: the auth user id, the matched agent profile
 * id + display name, the tenant, and the active scheme assignments.
 *
 * Why this exists: during the Session 6A → Session 14 saga we burned days
 * not knowing which agent profile a given session was actually resolving
 * to. With the earliest-profile fallback in place, the answer was
 * "always Orla" regardless of who logged in. With that fallback removed
 * (Session 15), the answer becomes meaningful — and this endpoint makes
 * it observable in one curl/browser tap.
 *
 * Response shape (200 always; never throws to the caller):
 *   {
 *     authenticated: boolean,
 *     authUserId: string | null,
 *     authEmail: string | null,
 *     agentProfileId: string | null,
 *     displayName: string | null,
 *     tenantId: string | null,
 *     agencyName: string | null,
 *     assignedSchemeCount: number,
 *     assignedSchemes: Array<{ id, name, unitCount }>,
 *     resolvedVia: 'auth-user' | 'no-profile' | 'no-auth-user',
 *     // when the resolver failed to match a profile, surface its trace so
 *     // we can see which step blanked
 *     trace?: Array<{ step, details, ms }>,
 *   }
 */

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        authUserId: null,
        authEmail: null,
        agentProfileId: null,
        displayName: null,
        tenantId: null,
        agencyName: null,
        assignedSchemeCount: 0,
        assignedSchemes: [],
        resolvedVia: 'no-auth-user' as const,
      });
    }

    const supabase = getSupabaseAdmin();
    const { context, trace } = await resolveAgentContextV2(supabase, user.id);

    if (!context) {
      return NextResponse.json({
        authenticated: true,
        authUserId: user.id,
        authEmail: user.email ?? null,
        agentProfileId: null,
        displayName: null,
        tenantId: null,
        agencyName: null,
        assignedSchemeCount: 0,
        assignedSchemes: [],
        resolvedVia: 'no-profile' as const,
        trace,
      });
    }

    return NextResponse.json({
      authenticated: true,
      authUserId: user.id,
      authEmail: user.email ?? null,
      agentProfileId: context.agentProfileId,
      displayName: context.displayName,
      tenantId: context.tenantId,
      agencyName: context.agencyName,
      assignedSchemeCount: context.assignedSchemes.length,
      assignedSchemes: context.assignedSchemes.map((s) => ({
        id: s.developmentId,
        name: s.schemeName,
        unitCount: s.unitCount,
      })),
      resolvedVia: 'auth-user' as const,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        authenticated: false,
        error: err?.message ?? 'whoami failed',
      },
      { status: 500 },
    );
  }
}
