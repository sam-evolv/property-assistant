/**
 * GET /api/snag/list
 *
 * Assistant V2 Sprint 2. Returns a paginated list of snags accessible
 * to the caller, with the media count attached to each row.
 *
 * Spec: docs/specs/assistant-v2-sprint-2.md section 5.4.
 *
 * Access scoping:
 *   - admin / site_team: every issue_reports row in their tenant
 *   - snagger_external:  only rows whose development_id is in their
 *                        development_ids array
 *
 * Optional query params:
 *   - development_id (uuid)
 *   - status (text)
 *   - limit (1-100, default 25)
 *   - offset (default 0)
 *
 * Gated on FEATURE_BUILDER_SNAG_APP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  assertCanAccessDevelopment,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const url = new URL(request.url);
  const developmentIdParam = url.searchParams.get('development_id');
  const unitIdParam = url.searchParams.get('unit_id');
  const statusParam = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');

  if (developmentIdParam && !UUID_RE.test(developmentIdParam)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }
  if (developmentIdParam) {
    try {
      assertCanAccessDevelopment(auth, developmentIdParam);
    } catch (err) {
      if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
      throw err;
    }
  }

  let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
  let offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('issue_reports')
    .select(
      'id, tenant_id, development_id, unit_id, title, description, room, status, priority, severity_label, source, logged_by_user_id, logged_by_role, created_at, updated_at',
      { count: 'exact' },
    )
    .eq('tenant_id', auth.tenantId);

  if (developmentIdParam) {
    query = query.eq('development_id', developmentIdParam);
  } else if (auth.role === 'snagger_external') {
    const allowed = Array.isArray(auth.developmentIds) ? auth.developmentIds : [];
    if (allowed.length === 0) {
      return NextResponse.json({ rows: [], total: 0, limit, offset });
    }
    query = query.in('development_id', allowed);
  }

  if (unitIdParam) {
    if (!UUID_RE.test(unitIdParam)) {
      return NextResponse.json({ error: 'unit_id must be a uuid' }, { status: 400 });
    }
    query = query.eq('unit_id', unitIdParam);
  }

  if (statusParam) {
    query = query.eq('status', statusParam);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: rows, error: listErr, count } = await query;
  if (listErr) {
    console.error('[snag-list] list_failed reason=%s', listErr.message);
    return NextResponse.json({ error: 'Could not load snags' }, { status: 500 });
  }
  const reportRows = rows ?? [];
  const ids = reportRows.map((r) => r.id as string);

  const mediaCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: joinRows, error: joinErr } = await supabase
      .from('issue_report_media')
      .select('issue_report_id')
      .in('issue_report_id', ids);
    if (joinErr) {
      console.error('[snag-list] media_count_failed reason=%s', joinErr.message);
    } else {
      for (const j of joinRows ?? []) {
        const k = j.issue_report_id as string;
        mediaCounts.set(k, (mediaCounts.get(k) ?? 0) + 1);
      }
    }
  }

  return NextResponse.json({
    rows: reportRows.map((r) => ({ ...r, media_count: mediaCounts.get(r.id as string) ?? 0 })),
    total: count ?? reportRows.length,
    limit,
    offset,
  });
}
