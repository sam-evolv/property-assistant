/**
 * GET /api/homeowners/issues-count
 *
 * Assistant V2 Sprint 3.5a. Returns the count of homeowner_new issues
 * across the caller's tenant. Powers the sidebar notification badge
 * next to the Homeowners nav link.
 *
 * Spec: docs/specs/assistant-v2-sprint-3-5a.md section 5.2.
 *
 * The query hits the partial index issue_reports_homeowner_new_idx on
 * (status) WHERE status = 'homeowner_new'. The combination of the index
 * and the tenant_id equality filter keeps the count cheap even at
 * scale; this route is called on every dashboard page load.
 *
 * Access scoping. admin and site_team only. snagger_external is
 * rejected with 403; the homeowner surfaces are developer-side only.
 *
 * Gated on FEATURE_HOMEOWNER_ISSUES.
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
  if (auth.role === 'snagger_external') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('issue_reports')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'homeowner_new');

  if (error) {
    console.error('[homeowners-issues-count] count_failed reason=%s', error.message);
    return NextResponse.json({ error: 'Could not load count' }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
