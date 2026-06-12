export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import {
  buildProgrammeCriteria,
  PROGRAMME_KEYS,
  type EvidenceContext,
  type ProgrammeKey,
} from '@/lib/compliance/programme-criteria';

/**
 * GET /api/developer/compliance/programme?developmentId=...&programme=hpi|bcar|homebond
 *
 * Evidence readiness for a named compliance programme — criteria defined
 * in lib/compliance/programme-criteria.ts, auto-filled from the live
 * record. Every evidence source is independently fail-soft.
 */

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const developmentId = request.nextUrl.searchParams.get('developmentId') || '';
  const programmeRaw = request.nextUrl.searchParams.get('programme') || 'hpi';
  if (!developmentId) {
    return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
  }
  if (!PROGRAMME_KEYS.includes(programmeRaw as ProgrammeKey)) {
    return NextResponse.json({ error: 'Unknown programme' }, { status: 400 });
  }
  const programme = programmeRaw as ProgrammeKey;

  const supabase = getSupabaseAdmin();
  const { data: development } = await supabase
    .from('developments')
    .select('id, name, tenant_id')
    .eq('id', developmentId)
    .maybeSingle();
  if (!development) return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, address, address_line_1')
    .eq('development_id', developmentId);
  const homes = units || [];

  const ctx: EvidenceContext = {
    totalHomes: homes.length,
    homeIds: homes.map((u) => u.id),
    unitLabel: new Map(homes.map((u) => [u.id, u.address || u.address_line_1 || u.unit_number || 'Unit'])),
    complianceTypes: [],
    complianceDocs: [],
    systems: [],
    events: [],
    archiveDisciplines: new Set<string>(),
    archiveTitles: [],
  };

  try {
    const [typesRes, docsRes] = await Promise.all([
      supabase
        .from('compliance_document_types')
        .select('id, name, category')
        .eq('development_id', developmentId),
      supabase
        .from('compliance_documents')
        .select('unit_id, document_type_id, status')
        .eq('development_id', developmentId),
    ]);
    ctx.complianceTypes = typesRes.data || [];
    ctx.complianceDocs = docsRes.data || [];
  } catch {}

  try {
    if (ctx.homeIds.length > 0) {
      const { data } = await supabase
        .from('unit_systems')
        .select('unit_id, system_type, commissioning_date, commissioning_doc_id')
        .in('unit_id', ctx.homeIds);
      ctx.systems = data || [];
    }
  } catch {}

  try {
    if (ctx.homeIds.length > 0) {
      const { data } = await supabase
        .from('handover_events')
        .select('unit_id, event_type')
        .in('unit_id', ctx.homeIds);
      ctx.events = data || [];
    }
  } catch {}

  try {
    const { data } = await supabase
      .from('documents')
      .select('title, file_name, discipline')
      .eq('development_id', developmentId)
      .limit(1000);
    for (const d of data || []) {
      if (d.discipline) ctx.archiveDisciplines.add(String(d.discipline).toLowerCase());
      const title = d.title || d.file_name;
      if (title) ctx.archiveTitles.push(String(title));
    }
  } catch {}

  const criteria = buildProgrammeCriteria(programme, ctx);
  const tracked = criteria.filter((c) => c.tracked);
  const sumTotal = tracked.reduce((s, c) => s + c.total, 0);
  const sumCovered = tracked.reduce((s, c) => s + c.covered, 0);

  return NextResponse.json({
    development: { id: development.id, name: development.name },
    programme,
    homes: ctx.totalHomes,
    criteria,
    overallPct: sumTotal > 0 ? Math.round((sumCovered / sumTotal) * 100) : 0,
    trackedCriteria: tracked.length,
    generatedAt: new Date().toISOString(),
  });
}
