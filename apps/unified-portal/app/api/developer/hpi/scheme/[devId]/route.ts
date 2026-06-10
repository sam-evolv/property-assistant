import { NextRequest, NextResponse } from 'next/server';
import { loadAuthorizedSchemeEvaluation } from '@/lib/hpi/scheme-access';
import { summariseHpiQa8 } from '@/lib/dev-app/unit-systems';
import { HPI_DISCLAIMER } from '@/lib/hpi/indicators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/hpi/scheme/[devId]
 *
 * Deep HPI evidence view for one scheme: the full indicator matrix, category
 * breakdown, projected (indicative) tier, gap list grouped-ready for the
 * chase-list, ROI metrics, and the per-home QA 8.0 summary so the existing
 * per-home table stays reachable. Auth scoped like /api/pipeline.
 */
export async function GET(_request: NextRequest, { params }: { params: { devId: string } }) {
  try {
    const result = await loadAuthorizedSchemeEvaluation(params.devId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Per-home QA 8.0 summary (mirrors the rollup shape used elsewhere) derived
    // from the already-assembled evidence — no extra DB round trip.
    const perUnitQa8 = result.evidence.map((u) => {
      const qa8 = summariseHpiQa8(u.systems, u.events);
      const guideIssued = qa8.guide_issued || u.guideIssued;
      return {
        id: u.unit.id,
        unit_number: u.unit.unit_number,
        address_line_1: u.unit.address_line_1,
        purchaser_name: u.unit.purchaser_name,
        guide_issued: guideIssued,
        demo_completed: qa8.demo_completed,
        aftercare_activated: qa8.aftercare_activated,
        systems_documented: qa8.systems_documented,
        qa8_ready: guideIssued && qa8.demo_completed,
      };
    });

    return NextResponse.json({
      development: { ...result.development, total_units: result.unitCount },
      evaluation: { ...result.evaluation, perUnitQa8 },
      roi: result.roi,
      disclaimer: HPI_DISCLAIMER,
    });
  } catch (error) {
    console.error('[Developer HPI] scheme error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
