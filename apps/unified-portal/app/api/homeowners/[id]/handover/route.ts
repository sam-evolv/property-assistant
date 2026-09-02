export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isHandoverEventType } from '@/lib/dev-app/unit-systems';

/**
 * POST /api/homeowners/[id]/handover
 * Log a handover event for a unit ([id] is units.id) — the QA 8.0 evidence
 * trail (demo_completed, aftercare_activated, ...). Auth mirrors the details
 * route (getAdminSession + service role).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!['super_admin', 'developer', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!isHandoverEventType(body?.event_type)) {
      return NextResponse.json({ error: 'valid event_type is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, tenant_id')
      .eq('id', id)
      .single();
    if (unitError || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('handover_events')
      .insert({
        tenant_id: (unit as any).tenant_id ?? null,
        unit_id: id,
        event_type: body.event_type,
        occurred_at: body.occurred_at ?? new Date().toISOString(),
        conducted_by: (session as any).id ?? null,
        conducted_by_name: (session as any).email ?? null,
        attended_by: body.attended_by ?? null,
        notes: body.notes ?? null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ event: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
