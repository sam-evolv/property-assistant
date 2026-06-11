export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { z } from 'zod';

/**
 * People — everyone with access to the tenant's schemes, in one place.
 * GET lists office team (admins), site team + external snaggers
 * (site_team_members) and open snagger invitations.
 * POST invites an office colleague: admins row + Supabase invite email.
 * DELETE removes an office colleague (never yourself, never the last one).
 */

export async function GET() {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();

  const { data: office } = await supabase
    .from('admins')
    .select('id, email, role, created_at')
    .eq('tenant_id', session.tenantId)
    .order('created_at', { ascending: true });

  // Site team + external snaggers (tables exist regardless of feature flag;
  // tolerate absence on older databases).
  let site: any[] = [];
  let invitations: any[] = [];
  try {
    const { data: members } = await supabase
      .from('site_team_members')
      .select('id, user_id, role, development_ids, active, expires_at, accepted_at')
      .eq('tenant_id', session.tenantId)
      .eq('active', true);
    if (members && members.length > 0) {
      const ids = members.map((m) => m.user_id).filter(Boolean);
      const emails = new Map<string, string>();
      for (const id of ids) {
        try {
          const { data } = await supabase.auth.admin.getUserById(id);
          if (data?.user?.email) emails.set(id, data.user.email);
        } catch {}
      }
      site = members.map((m) => ({ ...m, email: emails.get(m.user_id) || null }));
    }
  } catch {}
  try {
    const { data: invites } = await supabase
      .from('snagger_invitations')
      .select('id, email, development_id, expires_at, accepted_at, revoked_at, created_at')
      .eq('tenant_id', session.tenantId)
      .is('accepted_at', null)
      .is('revoked_at', null);
    invitations = invites || [];
  } catch {}

  return NextResponse.json({
    office: office || [],
    site,
    invitations,
    me: { id: session.id, email: session.email },
  });
}

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['developer', 'admin']),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email and role are required' }, { status: 400 });
  }
  const { email, role } = parsed.data;

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from('admins')
    .select('id, tenant_id')
    .eq('email', email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.tenant_id === session.tenantId
            ? 'They already have access.'
            : 'That email already belongs to another organisation.',
      },
      { status: 409 },
    );
  }

  const { data: admin, error: adminError } = await supabase
    .from('admins')
    .insert({
      email,
      role,
      tenant_id: session.tenantId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (adminError || !admin) {
    return NextResponse.json({ error: 'Could not add that person' }, { status: 500 });
  }

  // Invite email sets their password; if it can't be sent (no auth user is
  // created until then either), access still works the moment they sign up /
  // reset a password with this email — the admins row is the access.
  let inviteSent = false;
  try {
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${request.nextUrl.origin}/reset-password`,
    });
    inviteSent = !inviteError;
  } catch {}

  return NextResponse.json({
    success: true,
    adminId: admin.id,
    inviteSent,
    message: inviteSent
      ? 'Invite sent — they set a password from the email.'
      : 'Added. Ask them to use "Forgot password" with this email to set their password.',
  });
}

export async function DELETE(request: NextRequest) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId');
  if (!adminId) {
    return NextResponse.json({ error: 'adminId is required' }, { status: 400 });
  }
  if (adminId === session.id) {
    return NextResponse.json({ error: 'You can\'t remove yourself.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase
    .from('admins')
    .select('id, tenant_id')
    .eq('id', adminId)
    .maybeSingle();
  if (!target || target.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { count } = await supabase
    .from('admins')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', session.tenantId);
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'You can\'t remove the last account.' }, { status: 400 });
  }

  const { error } = await supabase.from('admins').delete().eq('id', adminId);
  if (error) {
    return NextResponse.json({ error: 'Could not remove that person' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
