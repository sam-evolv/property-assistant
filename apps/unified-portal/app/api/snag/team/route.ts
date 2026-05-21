/**
 * GET /api/snag/team
 *
 * Assistant V2 Sprint 2. Admin-only listing for /developer/snaggers.
 * Returns the tenant's site_team_members (with email joined from
 * auth.users) and the open snagger_invitations (not yet accepted,
 * not revoked).
 *
 * Gated on FEATURE_BUILDER_SNAG_APP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  assertIsAdmin,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUCTION_ORIGIN = 'https://portal.openhouseai.ie';

function resolveOrigin(request: NextRequest): string {
  if (process.env.VERCEL_ENV === 'production') return PRODUCTION_ORIGIN;
  const origin = request.headers.get('origin');
  if (origin && /^https?:\/\//.test(origin)) return origin;
  const host = request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  return PRODUCTION_ORIGIN;
}

export async function GET(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
    assertIsAdmin(auth);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();

  const { data: members, error: memErr } = await supabase
    .from('site_team_members')
    .select('id, user_id, role, development_ids, active, expires_at, invited_at, accepted_at')
    .eq('tenant_id', auth.tenantId)
    .order('invited_at', { ascending: false });
  if (memErr) {
    console.error('[snag-team] members_failed reason=%s', memErr.message);
    return NextResponse.json({ error: 'Could not load team' }, { status: 500 });
  }

  const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id as string)));
  const emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    for (const userId of userIds) {
      const { data: u } = await supabase.auth.admin.getUserById(userId);
      if (u?.user?.email) emailByUserId.set(userId, u.user.email);
    }
  }

  const { data: invites, error: inviteErr } = await supabase
    .from('snagger_invitations')
    .select('id, email, development_id, invited_by, token, expires_at, accepted_at, revoked_at, created_at')
    .eq('tenant_id', auth.tenantId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (inviteErr) {
    console.error('[snag-team] invites_failed reason=%s', inviteErr.message);
    return NextResponse.json({ error: 'Could not load invitations' }, { status: 500 });
  }

  const { data: developments } = await supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', auth.tenantId)
    .order('name', { ascending: true });

  const origin = resolveOrigin(request);
  const now = Date.now();

  return NextResponse.json({
    members: (members ?? []).map((m) => {
      const expiry = m.expires_at as string | null;
      const isExpired = !!expiry && new Date(expiry).getTime() <= now;
      return {
        id: m.id,
        user_id: m.user_id,
        email: emailByUserId.get(m.user_id as string) ?? null,
        role: m.role,
        development_ids: m.development_ids,
        active: m.active,
        expires_at: m.expires_at,
        invited_at: m.invited_at,
        accepted_at: m.accepted_at,
        is_expired: isExpired,
      };
    }),
    invitations: (invites ?? []).map((i) => {
      const expiry = i.expires_at as string;
      const isExpired = new Date(expiry).getTime() <= now;
      return {
        id: i.id,
        email: i.email,
        development_id: i.development_id,
        expires_at: i.expires_at,
        created_at: i.created_at,
        is_expired: isExpired,
        invite_url: `${origin}/snag/accept?token=${encodeURIComponent(i.token as string)}`,
      };
    }),
    developments: (developments ?? []).map((d) => ({ id: d.id, name: d.name })),
  });
}
