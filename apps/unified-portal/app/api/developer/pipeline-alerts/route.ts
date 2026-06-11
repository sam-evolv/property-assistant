export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/developer/pipeline-alerts
 *
 * The pipeline conditions that genuinely need a human today:
 *  - mortgage approvals expiring within 30 days on unsold-through homes
 *  - contracts issued more than 42 days ago with no signed return
 *  - open snags on homes handing over within 30 days
 *
 * Tenant-scoped. Each query is independently fail-soft so the endpoint
 * works before migration 070 (mortgage_expiry_date absent -> zero alerts).
 */

const AGED_CONTRACT_DAYS = 42;
const MORTGAGE_WINDOW_DAYS = 30;
const MAX_ITEMS = 5;

interface AlertItem {
  unitId: string;
  label: string;
  date: string;
  days: number;
}

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
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowIso = new Date(now + MORTGAGE_WINDOW_DAYS * 86_400_000).toISOString();
  const agedCutoffIso = new Date(now - AGED_CONTRACT_DAYS * 86_400_000).toISOString();

  let mortgageRows: Array<{ unit_id: string; mortgage_expiry_date: string }> = [];
  try {
    const { data, error } = await supabase
      .from('unit_sales_pipeline')
      .select('unit_id, mortgage_expiry_date')
      .eq('tenant_id', session.tenantId)
      .gte('mortgage_expiry_date', nowIso)
      .lte('mortgage_expiry_date', windowIso)
      .is('handover_date', null)
      .limit(50);
    if (!error && data) mortgageRows = data as typeof mortgageRows;
  } catch {}

  // Homes handing over within the window that still carry open snags.
  let snagRiskRows: Array<{ unit_id: string; handover: string; openCount: number }> = [];
  try {
    const { data: upcoming } = await supabase
      .from('unit_sales_pipeline')
      .select('unit_id, handover_date, projected_handover_date')
      .eq('tenant_id', session.tenantId)
      .or(
        `and(handover_date.gte.${nowIso},handover_date.lte.${windowIso}),and(handover_date.is.null,projected_handover_date.gte.${nowIso},projected_handover_date.lte.${windowIso})`,
      )
      .limit(100);
    const handoverByUnit = new Map<string, string>();
    for (const r of upcoming || []) {
      const when = (r as any).handover_date || (r as any).projected_handover_date;
      if (r.unit_id && when) handoverByUnit.set(r.unit_id, when);
    }
    if (handoverByUnit.size > 0) {
      const { data: openSnags } = await supabase
        .from('issue_reports')
        .select('unit_id')
        .eq('tenant_id', session.tenantId)
        .in('unit_id', Array.from(handoverByUnit.keys()))
        .in('status', ['open', 'reopened']);
      const counts = new Map<string, number>();
      for (const snag of openSnags || []) {
        if (snag.unit_id) counts.set(snag.unit_id, (counts.get(snag.unit_id) || 0) + 1);
      }
      snagRiskRows = Array.from(counts.entries()).map(([unit_id, openCount]) => ({
        unit_id,
        handover: handoverByUnit.get(unit_id)!,
        openCount,
      }));
    }
  } catch {}

  let openSnagsTotal = 0;
  try {
    const { count } = await supabase
      .from('issue_reports')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .in('status', ['open', 'reopened']);
    openSnagsTotal = count ?? 0;
  } catch {}

  let agedRows: Array<{ unit_id: string; contracts_issued_date: string }> = [];
  try {
    const { data, error } = await supabase
      .from('unit_sales_pipeline')
      .select('unit_id, contracts_issued_date')
      .eq('tenant_id', session.tenantId)
      .lte('contracts_issued_date', agedCutoffIso)
      .is('signed_contracts_date', null)
      .is('handover_date', null)
      .limit(50);
    if (!error && data) agedRows = data as typeof agedRows;
  } catch {}

  // Labels for the homes involved, one lookup.
  const unitIds = Array.from(
    new Set([...mortgageRows, ...agedRows, ...snagRiskRows].map((r) => r.unit_id).filter(Boolean)),
  );
  const labelById = new Map<string, string>();
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_number, address, address_line_1')
      .in('id', unitIds);
    for (const u of units || []) {
      labelById.set(u.id, u.address || u.address_line_1 || u.unit_number || 'Unit');
    }
  }

  const mortgageExpiring: AlertItem[] = mortgageRows
    .map((r) => ({
      unitId: r.unit_id,
      label: labelById.get(r.unit_id) || 'Unit',
      date: r.mortgage_expiry_date,
      days: Math.ceil((new Date(r.mortgage_expiry_date).getTime() - now) / 86_400_000),
    }))
    .sort((a, b) => a.days - b.days);

  const agedContracts: AlertItem[] = agedRows
    .map((r) => ({
      unitId: r.unit_id,
      label: labelById.get(r.unit_id) || 'Unit',
      date: r.contracts_issued_date,
      days: Math.floor((now - new Date(r.contracts_issued_date).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.days - a.days);

  const snagRisk = snagRiskRows
    .map((r) => ({
      unitId: r.unit_id,
      label: labelById.get(r.unit_id) || 'Unit',
      date: r.handover,
      days: Math.ceil((new Date(r.handover).getTime() - now) / 86_400_000),
      openSnags: r.openCount,
    }))
    .sort((a, b) => a.days - b.days);

  return NextResponse.json({
    openSnagsTotal,
    mortgageExpiring: {
      count: mortgageExpiring.length,
      items: mortgageExpiring.slice(0, MAX_ITEMS),
    },
    snagRisk: {
      count: snagRisk.length,
      totalOpenSnags: snagRisk.reduce((sum, r) => sum + r.openSnags, 0),
      items: snagRisk.slice(0, MAX_ITEMS),
    },
    agedContracts: {
      count: agedContracts.length,
      items: agedContracts.slice(0, MAX_ITEMS),
    },
  });
}
