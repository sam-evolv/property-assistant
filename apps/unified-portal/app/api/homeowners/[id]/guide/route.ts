export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@openhouse/api/session';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { generateHomeUserGuide } from '@/lib/dev-app/home-user-guide';

/**
 * Home User Guide for a unit (a "homeowner" is a unit; [id] is units.id).
 * Auth mirrors /api/homeowners/[id]/details (getAdminSession + service role).
 *
 *   GET  -> latest guide for the unit (or null)
 *   POST -> generate a new version from the unit's recorded systems.
 *           { issue: true } stamps issued_at and logs a 'guide_issued'
 *           handover event (which flips the unit's HPI qa8_ready).
 */
function authorised(role: string | undefined) {
  return !!role && ['super_admin', 'developer', 'admin'].includes(role);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!authorised(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('home_user_guides')
      .select('*')
      .eq('unit_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ guide: data ?? null });
  } catch {
    return NextResponse.json({ error: 'Failed to load guide' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!authorised(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const issue = body?.issue === true;
    const supabase = getSupabaseAdmin();

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('*')
      .eq('id', id)
      .single();
    if (unitError || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { data: systems } = await supabase
      .from('unit_systems')
      .select('*')
      .eq('unit_id', id);

    // Map the prod unit row (columns differ from the repo base schema) into the
    // generator's context shape.
    const unitContext = {
      unit_number: (unit as any).unit_number ?? (unit as any).unit_uid ?? null,
      address_line_1: (unit as any).address ?? (unit as any).address_line_1 ?? null,
      city: (unit as any).city ?? null,
      eircode: (unit as any).eircode ?? null,
      house_type_code: (unit as any).house_type_code ?? (unit as any).house_type ?? null,
    };

    let content;
    try {
      content = await generateHomeUserGuide(unitContext, systems ?? []);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const status = msg.includes('OPENAI_API_KEY') ? 503 : 502;
      return NextResponse.json({ error: 'guide_generation_failed', detail: msg }, { status });
    }

    const { data: last } = await supabase
      .from('home_user_guides')
      .select('version')
      .eq('unit_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (last?.version ?? 0) + 1;

    const { data: guide, error } = await supabase
      .from('home_user_guides')
      .insert({
        tenant_id: (unit as any).tenant_id ?? null,
        unit_id: id,
        version,
        content,
        model: content.model,
        generated_by: (session as any).id ?? null,
        status: issue ? 'issued' : 'draft',
        issued_at: issue ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (issue) {
      await supabase.from('handover_events').insert({
        tenant_id: (unit as any).tenant_id ?? null,
        unit_id: id,
        event_type: 'guide_issued',
        conducted_by: (session as any).id ?? null,
        conducted_by_name: (session as any).email ?? null,
        home_user_guide_version: version,
        notes: 'Home User Guide issued',
      });
    }

    return NextResponse.json({ guide }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
