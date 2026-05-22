/**
 * GET and POST /api/settings/notifications
 *
 * Assistant V2 Sprint 3.5a. Tenant-level notification preferences.
 * Currently surfaces a single field: the aftercare email address that
 * receives notifications when a new homeowner-raised issue arrives.
 *
 * Spec: docs/specs/assistant-v2-sprint-3-5a.md section 5.7.
 *
 * GET:
 *   - admin or site_team may read the tenant_settings row.
 *   - If no row exists yet, returns { tenant_id, aftercare_email: null }
 *     so the settings page can render the empty state.
 *
 * POST:
 *   - admin only. site_team can read but not modify.
 *   - Accepts { aftercare_email: string | null }.
 *   - When non-null, validated as a basic email shape.
 *   - Upserts the tenant_settings row keyed by tenant_id.
 *
 * tenant_settings has RLS with a service_role_bypass policy, so this
 * route uses the service-role client. tenant_id is always derived from
 * the verified site_team_members membership, never trusted from the
 * client.
 *
 * Gated on FEATURE_HOMEOWNER_ISSUES. With the flag off the route is
 * 404 before any auth or DB work, matching the rest of the Sprint 3.5a
 * surface area.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 320;

interface PostBody {
  aftercare_email?: unknown;
}

export async function GET(request: NextRequest) {
  if (!isHomeownerIssuesEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }
  if (auth.role !== 'admin' && auth.role !== 'site_team') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from('tenant_settings')
    .select('tenant_id, aftercare_email, updated_at, updated_by')
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  if (error) {
    console.error('[settings-notifications] read_failed reason=%s', error.message);
    return NextResponse.json({ error: 'Could not load settings' }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({
      tenant_id: auth.tenantId,
      aftercare_email: null,
      updated_at: null,
      updated_by: null,
    });
  }

  return NextResponse.json(row);
}

export async function POST(request: NextRequest) {
  if (!isHomeownerIssuesEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let payload: PostBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let aftercareEmail: string | null = null;
  if (payload.aftercare_email === null) {
    aftercareEmail = null;
  } else if (typeof payload.aftercare_email === 'string') {
    const trimmed = payload.aftercare_email.trim();
    if (trimmed.length === 0) {
      aftercareEmail = null;
    } else {
      if (trimmed.length > MAX_EMAIL_LEN) {
        return NextResponse.json({ error: 'aftercare_email is too long' }, { status: 400 });
      }
      if (!EMAIL_RE.test(trimmed)) {
        return NextResponse.json({ error: 'aftercare_email is not a valid email' }, { status: 400 });
      }
      aftercareEmail = trimmed;
    }
  } else {
    return NextResponse.json(
      { error: 'aftercare_email must be a string or null' },
      { status: 400 },
    );
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: row, error } = await supabase
    .from('tenant_settings')
    .upsert(
      {
        tenant_id: auth.tenantId,
        aftercare_email: aftercareEmail,
        updated_at: nowIso,
        updated_by: auth.userId,
      },
      { onConflict: 'tenant_id' },
    )
    .select('tenant_id, aftercare_email, updated_at, updated_by')
    .single();

  if (error || !row) {
    console.error('[settings-notifications] upsert_failed reason=%s', error?.message ?? 'no row');
    return NextResponse.json({ error: 'Could not save settings' }, { status: 500 });
  }

  return NextResponse.json(row);
}
