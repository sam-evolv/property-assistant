/**
 * GET /api/snag/houses?development_id=...
 *
 * The Houses screen of the snagging app: every unit in the development
 * with its open/done snag counts and handover date, in house-number
 * order (the order a human expects). Handover urgency travels as data
 * (days_to_handover) and is FLAGGED on the board, never used to
 * reshuffle it.
 *
 * Auth + scoping identical to /api/snag/units (snag-auth).
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
const OPEN_STATUSES = ['open', 'reopened'];

export async function GET(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  const url = new URL(request.url);
  const developmentId = url.searchParams.get('development_id') ?? '';
  if (!UUID_RE.test(developmentId)) {
    return NextResponse.json({ error: 'development_id must be a uuid' }, { status: 400 });
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
    assertCanAccessDevelopment(auth, developmentId);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();

  const { data: development, error: devErr } = await supabase
    .from('developments')
    .select('id, tenant_id, name')
    .eq('id', developmentId)
    .maybeSingle();
  if (devErr) {
    return NextResponse.json({ error: 'Could not load development' }, { status: 500 });
  }
  if (!development || development.tenant_id !== auth.tenantId) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  }

  const [unitsRes, snagsRes, pipelineRes] = await Promise.all([
    supabase
      .from('units')
      .select('id, unit_number, address, address_line_1, handover_date')
      .eq('development_id', developmentId),
    supabase
      .from('issue_reports')
      .select('unit_id, status')
      .eq('development_id', developmentId)
      .eq('tenant_id', auth.tenantId),
    supabase
      .from('unit_sales_pipeline')
      .select('unit_id, handover_date, projected_handover_date, snagging_start_date')
      .eq('development_id', developmentId),
  ]);

  if (unitsRes.error) {
    return NextResponse.json({ error: 'Could not load houses' }, { status: 500 });
  }

  const openByUnit = new Map<string, number>();
  const doneByUnit = new Map<string, number>();
  for (const snag of snagsRes.data || []) {
    if (!snag.unit_id) continue;
    if (OPEN_STATUSES.includes(snag.status)) {
      openByUnit.set(snag.unit_id, (openByUnit.get(snag.unit_id) || 0) + 1);
    } else {
      doneByUnit.set(snag.unit_id, (doneByUnit.get(snag.unit_id) || 0) + 1);
    }
  }

  const pipelineByUnit = new Map<string, { handover: string | null; snaggingStart: string | null }>();
  for (const row of pipelineRes.data || []) {
    pipelineByUnit.set(row.unit_id, {
      handover: row.handover_date || (row as any).projected_handover_date || null,
      snaggingStart: (row as any).snagging_start_date || null,
    });
  }

  const now = Date.now();
  const houses = (unitsRes.data || []).map((u) => {
    const pipeline = pipelineByUnit.get(u.id);
    const handover = pipeline?.handover || u.handover_date || null;
    const daysToHandover = handover
      ? Math.ceil((new Date(handover).getTime() - now) / 86_400_000)
      : null;
    return {
      id: u.id,
      label: u.unit_number || u.address || u.address_line_1 || 'Unit',
      address: u.address || u.address_line_1 || null,
      open_snags: openByUnit.get(u.id) || 0,
      done_snags: doneByUnit.get(u.id) || 0,
      handover_date: handover,
      days_to_handover: daysToHandover,
      snagging_start_date: pipeline?.snaggingStart || null,
    };
  });

  // House-number order: numeric where a number exists, alphabetical after.
  const houseNumber = (h: { label: string; address: string | null }): number => {
    const m = (h.label || '').match(/\d+/) || (h.address || '').match(/^\s*(\d+)/);
    return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
  };
  houses.sort((a, b) => {
    const diff = houseNumber(a) - houseNumber(b);
    if (diff !== 0) return diff;
    return (a.label || '').localeCompare(b.label || '', undefined, { numeric: true });
  });

  return NextResponse.json({
    development: { id: development.id, name: development.name },
    houses,
  });
}
