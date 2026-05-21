/**
 * GET /api/issues/overview
 *
 * Assistant V2 Sprint 3. Returns the four overview card counts for the
 * developer dashboard.
 *
 * Spec: docs/specs/assistant-v2-sprint-3.md section 5.1.
 *
 * Counts returned:
 *   - open                 status in ('open', 'reopened')
 *   - high_priority        severity_label in ('high', 'urgent')
 *   - new_this_week        created_at in the last 7 days
 *   - resolved_this_month  status = 'resolved' and resolved_at in last 30 days
 *
 * Scoped to the caller's tenant. admin and site_team see every development
 * in their tenant. snagger_external is rejected with 403 before any DB work
 * because the dashboard is developer-side only.
 *
 * Gated on FEATURE_DEVELOPER_DASHBOARD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isDeveloperDashboardEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isDeveloperDashboardEnabled()) {
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
  const tenantId = auth.tenantId;

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [openResult, highResult, weekResult, monthResult] = await Promise.all([
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'reopened']),
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('severity_label', ['high', 'urgent']),
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'resolved')
      .gte('resolved_at', thirtyDaysAgo),
  ]);

  for (const r of [openResult, highResult, weekResult, monthResult]) {
    if (r.error) {
      console.error('[issues-overview] count_failed reason=%s', r.error.message);
      return NextResponse.json({ error: 'Could not load overview' }, { status: 500 });
    }
  }

  return NextResponse.json({
    open: openResult.count ?? 0,
    high_priority: highResult.count ?? 0,
    new_this_week: weekResult.count ?? 0,
    resolved_this_month: monthResult.count ?? 0,
  });
}
