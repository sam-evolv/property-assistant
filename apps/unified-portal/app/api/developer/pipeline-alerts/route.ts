export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/developer/pipeline-alerts
 *
 * The two pipeline conditions that genuinely need a human today:
 *  - mortgage approvals expiring within 30 days on unsold-through homes
 *  - contracts issued more than 42 days ago with no signed return
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
    new Set([...mortgageRows, ...agedRows].map((r) => r.unit_id).filter(Boolean)),
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

  return NextResponse.json({
    mortgageExpiring: {
      count: mortgageExpiring.length,
      items: mortgageExpiring.slice(0, MAX_ITEMS),
    },
    agedContracts: {
      count: agedContracts.length,
      items: agedContracts.slice(0, MAX_ITEMS),
    },
  });
}
