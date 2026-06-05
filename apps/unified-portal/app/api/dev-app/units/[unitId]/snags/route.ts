import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit } from '@/lib/dev-app/snags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dev-app/units/[unitId]/snags
 * Read-only list of the unit's snags from the CANONICAL issue_reports system.
 * Creation and lifecycle live in the /snag (builder + invited snagger) and
 * /developer/issues flows; this surfaces real snag context on the unit file
 * alongside systems / handover / Home User Guide.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { unitId: string } },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const unit = await getOwnedUnit(supabase, user.id, params.unitId);
    if (!unit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('issue_reports')
      .select(
        'id, title, description, status, priority, severity_label, safety_risk, likely_trade, room, source, logged_by_role, resolved, resolved_at, created_at',
      )
      .eq('unit_id', unit.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ snags: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
