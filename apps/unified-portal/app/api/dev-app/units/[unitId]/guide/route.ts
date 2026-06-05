import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit } from '@/lib/dev-app/snags';
import { generateHomeUserGuide } from '@/lib/dev-app/home-user-guide';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dev-app/units/[unitId]/guide
 * Return the latest Home User Guide for a unit (or null if none generated yet).
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
      .from('home_user_guides')
      .select('*')
      .eq('unit_id', unit.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ guide: data ?? null });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/dev-app/units/[unitId]/guide
 * Generate a new guide version from the unit's current systems. Pass
 * { "issue": true } to issue it: that stamps issued_at AND records a
 * handover_events 'guide_issued' row (the QA 8.0 evidence that flips qa8_ready).
 */
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

    const body = await request.json().catch(() => ({}));
    const issue = body?.issue === true;
    const admin = getSupabaseAdmin();

    const [{ data: unitRow }, { data: systems }] = await Promise.all([
      admin
        .from('units')
        .select('unit_number, address_line_1, city, eircode, house_type_code')
        .eq('id', unit.id)
        .single(),
      admin.from('unit_systems').select('*').eq('unit_id', unit.id),
    ]);

    let content;
    try {
      content = await generateHomeUserGuide(unitRow ?? {}, systems ?? []);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const status = msg.includes('OPENAI_API_KEY') ? 503 : 502;
      return NextResponse.json({ error: 'guide_generation_failed', detail: msg }, { status });
    }

    const { data: last } = await admin
      .from('home_user_guides')
      .select('version')
      .eq('unit_id', unit.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (last?.version ?? 0) + 1;

    const { data: guide, error } = await admin
      .from('home_user_guides')
      .insert({
        tenant_id: unit.tenant_id,
        unit_id: unit.id,
        version,
        content,
        model: content.model,
        generated_by: user.id,
        status: issue ? 'issued' : 'draft',
        issued_at: issue ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Issuing the guide is QA 8.0 evidence — log it on the handover trail.
    if (issue) {
      await admin.from('handover_events').insert({
        tenant_id: unit.tenant_id,
        unit_id: unit.id,
        event_type: 'guide_issued',
        conducted_by: user.id,
        conducted_by_name: user.email ?? null,
        home_user_guide_version: version,
        notes: 'Home User Guide issued',
      });
    }

    return NextResponse.json({ guide }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
