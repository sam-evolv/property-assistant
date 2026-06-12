export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/developer/compliance/hpi?developmentId=...
 *
 * HPI (Home Performance Index) evidence readiness for one scheme — each
 * criterion auto-fills from the live record: compliance documents (by
 * type-name match), commissioned systems (unit_systems), handover events
 * and the document archive. This reports EVIDENCE COVERAGE, not the
 * certification itself; criteria with no matching source say so rather
 * than pretending.
 */

const GOOD_STATUSES = ['uploaded', 'verified'];

interface Criterion {
  key: string;
  label: string;
  scope: 'home' | 'scheme';
  covered: number;
  total: number;
  source: string;
  missing: string[];
  tracked: boolean;
}

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const developmentId = request.nextUrl.searchParams.get('developmentId') || '';
  if (!developmentId) {
    return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
  }

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
  const totalHomes = homes.length;
  const unitLabel = new Map<string, string>(
    homes.map((u) => [u.id, u.address || u.address_line_1 || u.unit_number || 'Unit']),
  );
  const allUnitIds = homes.map((u) => u.id);

  // Evidence sources — each independently fail-soft.
  let complianceTypes: Array<{ id: string; name: string }> = [];
  let complianceDocs: Array<{ unit_id: string; document_type_id: string; status: string }> = [];
  try {
    const [typesRes, docsRes] = await Promise.all([
      supabase.from('compliance_document_types').select('id, name').eq('development_id', developmentId),
      supabase
        .from('compliance_documents')
        .select('unit_id, document_type_id, status')
        .eq('development_id', developmentId),
    ]);
    complianceTypes = typesRes.data || [];
    complianceDocs = docsRes.data || [];
  } catch {}

  let systems: Array<{ unit_id: string; system_type: string; commissioning_date: string | null; commissioning_doc_id: string | null }> = [];
  try {
    if (allUnitIds.length > 0) {
      const { data } = await supabase
        .from('unit_systems')
        .select('unit_id, system_type, commissioning_date, commissioning_doc_id')
        .in('unit_id', allUnitIds);
      systems = data || [];
    }
  } catch {}

  let events: Array<{ unit_id: string; event_type: string }> = [];
  try {
    if (allUnitIds.length > 0) {
      const { data } = await supabase
        .from('handover_events')
        .select('unit_id, event_type')
        .in('unit_id', allUnitIds);
      events = data || [];
    }
  } catch {}

  let docDisciplines = new Set<string>();
  try {
    const { data } = await supabase
      .from('documents')
      .select('discipline')
      .eq('development_id', developmentId)
      .limit(1000);
    docDisciplines = new Set((data || []).map((d) => (d.discipline || '').toLowerCase()).filter(Boolean));
  } catch {}

  // Helpers
  const homesWithComplianceDoc = (typePattern: RegExp): Set<string> | null => {
    const matchingTypeIds = complianceTypes.filter((t) => typePattern.test(t.name)).map((t) => t.id);
    if (matchingTypeIds.length === 0) return null; // not tracked
    const ids = new Set(matchingTypeIds);
    const covered = new Set<string>();
    for (const d of complianceDocs) {
      if (ids.has(d.document_type_id) && GOOD_STATUSES.includes(d.status)) covered.add(d.unit_id);
    }
    return covered;
  };
  const homesWithCommissionedSystem = (types: string[]): Set<string> => {
    const covered = new Set<string>();
    for (const s of systems) {
      if (types.includes(s.system_type) && (s.commissioning_date || s.commissioning_doc_id)) {
        covered.add(s.unit_id);
      }
    }
    return covered;
  };
  const homesWithEvent = (eventType: string): Set<string> => {
    const covered = new Set<string>();
    for (const e of events) if (e.event_type === eventType) covered.add(e.unit_id);
    return covered;
  };
  const missingOf = (covered: Set<string>): string[] =>
    homes
      .filter((u) => !covered.has(u.id))
      .map((u) => unitLabel.get(u.id) || 'Unit')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .slice(0, 10);

  const perHome = (
    key: string,
    label: string,
    covered: Set<string> | null,
    source: string,
    fallback?: { covered: Set<string>; source: string },
  ): Criterion => {
    let set = covered;
    let src = source;
    if ((set === null || set.size === 0) && fallback && fallback.covered.size > 0) {
      set = fallback.covered;
      src = fallback.source;
    }
    if (set === null) {
      return { key, label, scope: 'home', covered: 0, total: totalHomes, source, missing: [], tracked: false };
    }
    return {
      key,
      label,
      scope: 'home',
      covered: Math.min(set.size, totalHomes),
      total: totalHomes,
      source: src,
      missing: missingOf(set),
      tracked: true,
    };
  };

  const criteria: Criterion[] = [
    perHome('ber', 'BER certificate', homesWithComplianceDoc(/\bber\b|building energy/i), 'Compliance record'),
    perHome('airtightness', 'Airtightness test result', homesWithComplianceDoc(/airtight|air ?perm|blower/i), 'Compliance record'),
    perHome(
      'ventilation',
      'Ventilation commissioning',
      homesWithComplianceDoc(/ventilation.*(commission|valid)|commission.*ventilation/i),
      'Compliance record',
      { covered: homesWithCommissionedSystem(['ventilation', 'mvhr']), source: 'Commissioned systems' },
    ),
    perHome(
      'heating',
      'Heating system commissioning',
      homesWithComplianceDoc(/heat ?pump.*commission|commission.*heat|boiler.*commission/i),
      'Compliance record',
      { covered: homesWithCommissionedSystem(['heat_pump', 'heating_controls', 'hot_water']), source: 'Commissioned systems' },
    ),
    perHome('guide', 'Home User Guide issued', homesWithEvent('guide_issued'), 'Handover record'),
    perHome('demo', 'Resident handover demonstration', homesWithEvent('demo_completed'), 'Handover record'),
    {
      key: 'drawings',
      label: 'Design drawings & specifications filed',
      scope: 'scheme',
      covered: docDisciplines.has('architectural') ? 1 : 0,
      total: 1,
      source: 'Document archive',
      missing: docDisciplines.has('architectural') ? [] : ['No architectural documents in the archive'],
      tracked: true,
    },
    {
      key: 'services',
      label: 'Building services documentation filed',
      scope: 'scheme',
      covered: docDisciplines.has('mechanical') || docDisciplines.has('electrical') || docDisciplines.has('plumbing') ? 1 : 0,
      total: 1,
      source: 'Document archive',
      missing:
        docDisciplines.has('mechanical') || docDisciplines.has('electrical') || docDisciplines.has('plumbing')
          ? []
          : ['No mechanical/electrical/plumbing documents in the archive'],
      tracked: true,
    },
  ];

  const tracked = criteria.filter((c) => c.tracked);
  const sumTotal = tracked.reduce((s, c) => s + c.total, 0);
  const sumCovered = tracked.reduce((s, c) => s + c.covered, 0);

  return NextResponse.json({
    development: { id: development.id, name: development.name },
    homes: totalHomes,
    criteria,
    overallPct: sumTotal > 0 ? Math.round((sumCovered / sumTotal) * 100) : 0,
    trackedCriteria: tracked.length,
    generatedAt: new Date().toISOString(),
  });
}
