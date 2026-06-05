import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit } from '@/lib/dev-app/snags';
import { isUnitSystemType } from '@/lib/dev-app/unit-systems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/dev-app/units/[unitId]/systems  — list the systems installed in a home
 * POST /api/dev-app/units/[unitId]/systems  — record a system (captured at handover)
 *
 * unit_systems is what lets the assistant educate a homeowner about THEIR heat
 * pump / MVHR, and what the Home User Guide is generated from.
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
      .from('unit_systems')
      .select('*')
      .eq('unit_id', unit.id)
      .order('system_type');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ systems: data ?? [] });
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
    if (!isUnitSystemType(body?.system_type)) {
      return NextResponse.json({ error: 'valid system_type is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('unit_systems')
      .insert({
        tenant_id: unit.tenant_id,
        unit_id: unit.id,
        system_type: body.system_type,
        make: body.make ?? null,
        model: body.model ?? null,
        serial_number: body.serial_number ?? null,
        key_settings: body.key_settings ?? {},
        commissioning_date: body.commissioning_date ?? null,
        commissioning_doc_id: body.commissioning_doc_id ?? null,
        warranty_start: body.warranty_start ?? null,
        warranty_end: body.warranty_end ?? null,
        warranty_doc_id: body.warranty_doc_id ?? null,
        maintenance_interval_months: body.maintenance_interval_months ?? null,
        manufacturer_guide_doc_id: body.manufacturer_guide_doc_id ?? null,
        knowledge_refs: Array.isArray(body.knowledge_refs) ? body.knowledge_refs : [],
        notes: body.notes ?? null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ system: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
