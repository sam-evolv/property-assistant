// lib/hpi/load-evidence.ts
//
// Server-side assembly of RawUnitEvidence[] from the live tables, shared by the
// developer HPI summary (portfolio) and the deep per-scheme route. Takes a
// service-role Supabase client; callers MUST authorize the developments first.

import type { RawUnitEvidence } from './evaluate';

interface UnitRow {
  id: string;
  unit_number: string | null;
  address_line_1: string | null;
  purchaser_name: string | null;
  house_type_code: string | null;
  development_id: string;
}

/**
 * Loads handover_events, unit_systems, issued home_user_guides and compliance
 * documents (joined to their type names) for the given units, and folds them
 * into RawUnitEvidence[] keyed back to each unit. One batched query per table.
 */
export async function loadSchemeEvidence(
  admin: any,
  units: UnitRow[],
): Promise<RawUnitEvidence[]> {
  if (units.length === 0) return [];
  const unitIds = units.map((u) => u.id);

  const [eventsRes, systemsRes, guidesRes, complianceRes, typesRes] = await Promise.all([
    admin.from('handover_events').select('unit_id, event_type, home_user_guide_version').in('unit_id', unitIds),
    admin
      .from('unit_systems')
      .select('unit_id, system_type, commissioning_date, warranty_end, warranty_doc_id')
      .in('unit_id', unitIds),
    admin.from('home_user_guides').select('unit_id, status').in('unit_id', unitIds).eq('status', 'issued'),
    admin
      .from('compliance_documents')
      .select('unit_id, status, expiry_date, document_type_id')
      .in('unit_id', unitIds),
    admin.from('compliance_document_types').select('id, name'),
  ]);

  const typeName: Record<string, string> = Object.fromEntries(
    (typesRes.data ?? []).map((t: any) => [t.id, (t.name ?? '').toLowerCase()]),
  );

  const eventsByUnit: Record<string, any[]> = {};
  for (const e of eventsRes.data ?? []) (eventsByUnit[e.unit_id] ||= []).push(e);

  const systemsByUnit: Record<string, any[]> = {};
  for (const s of systemsRes.data ?? []) (systemsByUnit[s.unit_id] ||= []).push(s);

  const issuedGuideUnits = new Set((guidesRes.data ?? []).map((g: any) => g.unit_id));

  // Per unit, the latest doc per type name (keep the highest-signal status:
  // verified > expired > others; but simplest correct: last write wins by
  // grouping — there is a unique (unit_id, document_type_id) so one row each).
  const complianceByUnit: Record<string, Record<string, { status: string; expiry_date: string | null }>> = {};
  for (const d of complianceRes.data ?? []) {
    const name = typeName[d.document_type_id];
    if (!name) continue;
    (complianceByUnit[d.unit_id] ||= {})[name] = {
      status: d.status,
      expiry_date: d.expiry_date ?? null,
    };
  }

  return units.map((u) => ({
    unit: {
      id: u.id,
      unit_number: u.unit_number,
      address_line_1: u.address_line_1,
      purchaser_name: u.purchaser_name,
      house_type_code: u.house_type_code,
    },
    systems: systemsByUnit[u.id] ?? [],
    events: eventsByUnit[u.id] ?? [],
    guideIssued: issuedGuideUnits.has(u.id),
    complianceByType: complianceByUnit[u.id] ?? {},
  }));
}
