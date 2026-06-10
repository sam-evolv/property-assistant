import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { rollupHpiEvidence } from '@/lib/dev-app/hpi-rollup';

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

    // Evidence tables are service-role access (RLS) — read after ownership scoping above
    const developments = await rollupHpiEvidence(
      getSupabaseAdmin(),
      devList,
      (units ?? []) as any[],
    );

    return NextResponse.json({ developments });
  } catch (error) {
    console.error('[HPI] summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
