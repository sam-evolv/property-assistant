// lib/dev-app/hpi-rollup.ts
// Shared QA 8.0 evidence rollup: given a set of units, batch-load their
// handover events, systems and issued guides (service-role client) and fold
// them into per-unit + per-development readiness summaries. Used by both the
// dev-app HPI board API (developer_user_id model) and the developer-portal
// HPI page API (admin session / tenant model).

import { summariseHpiQa8 } from '@/lib/dev-app/unit-systems';

export interface HpiRollupUnitInput {
  id: string;
  unit_number: string | null;
  address_line_1: string | null;
  purchaser_name?: string | null;
  development_id: string;
}

export interface HpiUnitSummary {
  id: string;
  unit_number: string | null;
  address_line_1: string | null;
  purchaser_name: string | null;
  guide_issued: boolean;
  demo_completed: boolean;
  aftercare_activated: boolean;
  systems_documented: number;
  qa8_ready: boolean;
}

export interface HpiDevelopmentSummary {
  id: string;
  name: string;
  total_units: number;
  qa8_ready: number;
  guide_issued: number;
  demo_completed: number;
  aftercare_activated: number;
  units: HpiUnitSummary[];
}

/**
 * `admin` is a service-role Supabase client. Evidence tables are RLS
 * service-role access; callers must have completed their own ownership/tenant
 * authorization over `unitList` before calling this.
 */
export async function rollupHpiEvidence(
  admin: any,
  developmentList: Array<{ id: string; name: string }>,
  unitList: HpiRollupUnitInput[],
): Promise<HpiDevelopmentSummary[]> {
  if (unitList.length === 0) {
    return developmentList.map((d) => ({
      id: d.id,
      name: d.name,
      total_units: 0,
      qa8_ready: 0,
      guide_issued: 0,
      demo_completed: 0,
      aftercare_activated: 0,
      units: [],
    }));
  }

  const unitIds = unitList.map((u) => u.id);
  const [eventsRes, systemsRes, guidesRes] = await Promise.all([
    admin
      .from('handover_events')
      .select('unit_id, event_type, home_user_guide_version')
      .in('unit_id', unitIds),
    admin.from('unit_systems').select('unit_id, warranty_end, warranty_doc_id').in('unit_id', unitIds),
    admin.from('home_user_guides').select('unit_id, status').in('unit_id', unitIds).eq('status', 'issued'),
  ]);

  const eventsByUnit: Record<string, any[]> = {};
  for (const e of eventsRes.data ?? []) {
    (eventsByUnit[e.unit_id] ||= []).push(e);
  }
  const systemsByUnit: Record<string, any[]> = {};
  for (const s of systemsRes.data ?? []) {
    (systemsByUnit[s.unit_id] ||= []).push(s);
  }
  const issuedGuideUnits = new Set((guidesRes.data ?? []).map((g: any) => g.unit_id));

  return developmentList.map((d) => {
    const devUnits = unitList.filter((u) => u.development_id === d.id);
    const unitSummaries: HpiUnitSummary[] = devUnits.map((u) => {
      const evidence = summariseHpiQa8(systemsByUnit[u.id] ?? [], eventsByUnit[u.id] ?? []);
      // An issued guide row counts as guide evidence even before the
      // handover_events 'guide_issued' row exists (older data paths)
      const guideIssued = evidence.guide_issued || issuedGuideUnits.has(u.id);
      return {
        id: u.id,
        unit_number: u.unit_number,
        address_line_1: u.address_line_1,
        purchaser_name: u.purchaser_name ?? null,
        guide_issued: guideIssued,
        demo_completed: evidence.demo_completed,
        aftercare_activated: evidence.aftercare_activated,
        systems_documented: evidence.systems_documented,
        qa8_ready: guideIssued && evidence.demo_completed,
      };
    });

    return {
      id: d.id,
      name: d.name,
      total_units: unitSummaries.length,
      qa8_ready: unitSummaries.filter((u) => u.qa8_ready).length,
      guide_issued: unitSummaries.filter((u) => u.guide_issued).length,
      demo_completed: unitSummaries.filter((u) => u.demo_completed).length,
      aftercare_activated: unitSummaries.filter((u) => u.aftercare_activated).length,
      units: unitSummaries,
    };
  });
}
