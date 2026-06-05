import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit } from '@/lib/dev-app/snags';
import { isHandoverEventType } from '@/lib/dev-app/unit-systems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/dev-app/units/[unitId]/handover  — the handover/aftercare event trail
 * POST /api/dev-app/units/[unitId]/handover  — record an event (demo, guide issued...)
 *
 * This is the QA 8.0 evidence: proof the demonstration happened, the Home User
 * Guide was issued, aftercare was activated. Append-only.
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
      .from('handover_events')
      .select('*')
      .eq('unit_id', unit.id)
      .order('occurred_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => null);
    if (!isHandoverEventType(body?.event_type)) {
      return NextResponse.json({ error: 'valid event_type is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('handover_events')
      .insert({
        tenant_id: unit.tenant_id,
        unit_id: unit.id,
        event_type: body.event_type,
        occurred_at: body.occurred_at ?? new Date().toISOString(),
        conducted_by: user.id,
        conducted_by_name: body.conducted_by_name ?? user.email ?? null,
        attended_by: body.attended_by ?? null,
        acknowledgement_ref: body.acknowledgement_ref ?? null,
        home_user_guide_version: body.home_user_guide_version ?? null,
        media_refs: Array.isArray(body.media_refs) ? body.media_refs : [],
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
