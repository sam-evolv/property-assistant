import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { summariseHpiQa8 } from '@/lib/dev-app/unit-systems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dev-app/hpi/summary
 *
 * Portfolio HPI QA 8.0 (Consumer Information & Aftercare) readiness board:
 * for every development the developer owns, per-unit evidence state
 * (Home User Guide issued, handover demo logged, aftercare activated,
 * systems documented) plus scheme-level ready counts. This is the evidence
 * trail an HPI assessor reviews at as-built stage.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: devs } = await supabase
      .from('developments')
      .select('id, name')
      .eq('developer_user_id', user.id);

    const devList = (devs ?? []) as Array<{ id: string; name: string }>;
    if (devList.length === 0) return NextResponse.json({ developments: [] });
    const devIds = devList.map((d) => d.id);

    const { data: units } = await supabase
      .from('units')
      .select('id, unit_number, address_line_1, development_id')
      .in('development_id', devIds)
      .order('unit_number');

    const unitList = (units ?? []) as Array<{
      id: string;
      unit_number: string;
      address_line_1: string | null;
      development_id: string;
    }>;
    if (unitList.length === 0) {
      return NextResponse.json({
        developments: devList.map((d) => ({ ...d, total_units: 0, qa8_ready: 0, units: [] })),
      });
    }
    const unitIds = unitList.map((u) => u.id);

    // Evidence tables are service-role access (RLS) — read after ownership scoping above
    const admin = getSupabaseAdmin();
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

    const developments = devList.map((d) => {
      const devUnits = unitList.filter((u) => u.development_id === d.id);
      const unitSummaries = devUnits.map((u) => {
        const evidence = summariseHpiQa8(systemsByUnit[u.id] ?? [], eventsByUnit[u.id] ?? []);
        // An issued guide row counts as guide evidence even before the
        // handover_events 'guide_issued' row exists (older data paths)
        const guideIssued = evidence.guide_issued || issuedGuideUnits.has(u.id);
        return {
          id: u.id,
          unit_number: u.unit_number,
          address_line_1: u.address_line_1,
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

    return NextResponse.json({ developments });
  } catch (error) {
    console.error('[HPI] summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
