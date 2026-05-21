/**
 * POST /api/snag/accept
 *
 * Assistant V2 Sprint 2. Public route that consumes a snagger invitation
 * token and grants the authenticated user a site_team_members row with
 * role snagger_external.
 *
 * Spec: docs/specs/assistant-v2-sprint-2.md section 5.2.
 *
 * The route still requires the caller to have an active Supabase session.
 * The invitation's email must match the session user's email.
 *
 * Gated on FEATURE_BUILDER_SNAG_APP. With the flag off the route returns
 * 404 before any auth or DB work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { snagFeatureDisabledResponse } from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AcceptBody {
  token?: unknown;
}

export async function POST(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let body: AcceptBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();

  if (userErr || !user?.id || !user.email) {
    return NextResponse.json(
      { error: 'Sign in before accepting an invitation' },
      { status: 401 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: invitation, error: lookupErr } = await admin
    .from('snagger_invitations')
    .select('id, tenant_id, development_id, email, expires_at, accepted_at, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (lookupErr) {
    console.error('[snag-accept] lookup_failed reason=%s', lookupErr.message);
    return NextResponse.json({ error: 'Could not load invitation' }, { status: 500 });
  }
  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }
  if (invitation.revoked_at) {
    return NextResponse.json({ error: 'Invitation has been revoked' }, { status: 410 });
  }
  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'Invitation has already been accepted' }, { status: 410 });
  }
  if (new Date(invitation.expires_at as string).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  const inviteEmail = String(invitation.email).trim().toLowerCase();
  const sessionEmail = user.email.trim().toLowerCase();
  if (inviteEmail !== sessionEmail) {
    console.warn(
      '[snag-accept] EMAIL_MISMATCH invitation_id=%s invite_email=%s session_email=%s',
      invitation.id,
      inviteEmail,
      sessionEmail,
    );
    return NextResponse.json(
      { error: 'This invitation was issued to a different email address' },
      { status: 403 },
    );
  }

  const { data: existing, error: existingErr } = await admin
    .from('site_team_members')
    .select('id, role, active, expires_at')
    .eq('user_id', user.id)
    .eq('tenant_id', invitation.tenant_id)
    .eq('active', true)
    .maybeSingle();

  if (existingErr) {
    console.error('[snag-accept] existing_lookup_failed reason=%s', existingErr.message);
    return NextResponse.json({ error: 'Could not check existing membership' }, { status: 500 });
  }

  if (existing) {
    const { error: updateInviteErr } = await admin
      .from('snagger_invitations')
      .update({ accepted_at: new Date().toISOString(), accepted_by_user_id: user.id })
      .eq('id', invitation.id);
    if (updateInviteErr) {
      console.error('[snag-accept] invitation_update_failed reason=%s', updateInviteErr.message);
    }
    return NextResponse.json({
      success: true,
      already_member: true,
      tenant_id: invitation.tenant_id,
      development_ids: [invitation.development_id],
    });
  }

  const { error: memberErr } = await admin
    .from('site_team_members')
    .insert({
      tenant_id: invitation.tenant_id,
      user_id: user.id,
      role: 'snagger_external',
      development_ids: [invitation.development_id],
      active: true,
      invited_by: null,
      accepted_at: new Date().toISOString(),
      expires_at: invitation.expires_at,
    });

  if (memberErr) {
    console.error('[snag-accept] member_insert_failed reason=%s', memberErr.message);
    return NextResponse.json({ error: 'Could not create membership' }, { status: 500 });
  }

  const { error: updateInviteErr } = await admin
    .from('snagger_invitations')
    .update({ accepted_at: new Date().toISOString(), accepted_by_user_id: user.id })
    .eq('id', invitation.id);
  if (updateInviteErr) {
    console.error('[snag-accept] invitation_update_failed reason=%s', updateInviteErr.message);
  }

  return NextResponse.json({
    success: true,
    tenant_id: invitation.tenant_id,
    development_ids: [invitation.development_id],
  });
}
