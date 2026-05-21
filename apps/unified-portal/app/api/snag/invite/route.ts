/**
 * POST /api/snag/invite
 *
 * Assistant V2 Sprint 2. Admin-only route that creates a snagger
 * invitation and returns a one-time signup URL.
 *
 * Spec: docs/specs/assistant-v2-sprint-2.md section 5.1.
 *
 * Email sending is out of scope for V1. The admin copies the link and
 * sends it themselves via whatever channel they already use. Polished
 * invitation emails are a later sprint.
 *
 * Gated on FEATURE_BUILDER_SNAG_APP. With the flag off the route returns
 * 404 before any auth or DB work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_EXPIRES_DAYS = 1;
const MAX_EXPIRES_DAYS = 90;
const PRODUCTION_ORIGIN = 'https://portal.openhouseai.ie';

interface InviteBody {
  email?: unknown;
  development_id?: unknown;
  expires_in_days?: unknown;
}

function resolveOrigin(request: NextRequest): string {
  if (process.env.VERCEL_ENV === 'production') {
    return PRODUCTION_ORIGIN;
  }
  const origin = request.headers.get('origin');
  if (origin && /^https?:\/\//.test(origin)) {
    return origin;
  }
  const host = request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  return PRODUCTION_ORIGIN;
}

export async function POST(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const developmentId = typeof body.development_id === 'string' ? body.development_id : '';
  const expiresInDays = typeof body.expires_in_days === 'number' ? Math.round(body.expires_in_days) : NaN;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  if (!UUID_RE.test(developmentId)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  if (!Number.isFinite(expiresInDays) || expiresInDays < MIN_EXPIRES_DAYS || expiresInDays > MAX_EXPIRES_DAYS) {
    return NextResponse.json(
      { error: `expires_in_days must be between ${MIN_EXPIRES_DAYS} and ${MAX_EXPIRES_DAYS}` },
      { status: 400 },
    );
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

  const { data: development, error: devErr } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('id', developmentId)
    .maybeSingle();

  if (devErr) {
    console.error('[snag-invite] development_lookup_failed reason=%s', devErr.message);
    return NextResponse.json({ error: 'Could not load development' }, { status: 500 });
  }
  if (!development) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  }
  if (development.tenant_id !== auth.tenantId) {
    console.warn(
      '[snag-invite] CROSS_TENANT_DEVELOPMENT caller_tenant=%s dev_tenant=%s',
      auth.tenantId,
      development.tenant_id,
    );
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: inviteRow, error: insertErr } = await supabase
    .from('snagger_invitations')
    .insert({
      tenant_id: auth.tenantId,
      development_id: developmentId,
      email,
      invited_by: auth.userId,
      token,
      expires_at: expiresAt,
    })
    .select('id, token, expires_at')
    .single();

  if (insertErr || !inviteRow) {
    console.error('[snag-invite] insert_failed reason=%s', insertErr?.message ?? 'no row');
    return NextResponse.json({ error: 'Could not create invitation' }, { status: 500 });
  }

  const origin = resolveOrigin(request);
  const inviteUrl = `${origin}/snag/accept?token=${encodeURIComponent(inviteRow.token as string)}`;

  return NextResponse.json({
    invitation_id: inviteRow.id,
    invite_url: inviteUrl,
    expires_at: inviteRow.expires_at,
  });
}
