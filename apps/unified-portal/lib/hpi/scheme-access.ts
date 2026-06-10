// lib/hpi/scheme-access.ts
//
// Shared auth + evidence loading for the developer-portal HPI scheme routes
// (deep view, chase-list, draft-request). Scopes like /api/pipeline:
// super_admin sees any development, everyone else is tenant-scoped.

import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { loadSchemeEvidence } from '@/lib/hpi/load-evidence';
import { evaluateScheme, computeRoi, type SchemeEvaluation, type RawUnitEvidence } from '@/lib/hpi/evaluate';

export interface SchemeAccessResult {
  ok: true;
  development: { id: string; name: string; address: string | null };
  evaluation: SchemeEvaluation;
  roi: ReturnType<typeof computeRoi>;
  evidence: RawUnitEvidence[];
  unitCount: number;
}
export interface SchemeAccessError {
  ok: false;
  status: number;
  error: string;
}

export async function loadAuthorizedSchemeEvaluation(
  devId: string,
): Promise<SchemeAccessResult | SchemeAccessError> {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const isSuperAdmin = session.role === 'super_admin';
  if (!session.tenantId && !isSuperAdmin) {
    return { ok: false, status: 400, error: 'Tenant context required' };
  }

  const admin = getSupabaseAdmin();
  const { data: development } = await admin
    .from('developments')
    .select('id, name, address, tenant_id')
    .eq('id', devId)
    .single();

  if (!development) return { ok: false, status: 404, error: 'Not found' };
  if (!isSuperAdmin && development.tenant_id !== session.tenantId) {
    return { ok: false, status: 404, error: 'Not found' };
  }

  const { data: units } = await admin
    .from('units')
    .select('id, unit_number, address_line_1, purchaser_name, house_type_code, development_id')
    .eq('development_id', development.id)
    .order('unit_number');

  const unitRows = (units ?? []) as any[];
  const evidence = await loadSchemeEvidence(admin, unitRows);
  const evaluation = evaluateScheme(evidence);
  const roi = computeRoi([evidence]);

  return {
    ok: true,
    development: { id: development.id, name: development.name, address: development.address ?? null },
    evaluation,
    roi,
    evidence,
    unitCount: unitRows.length,
  };
}
