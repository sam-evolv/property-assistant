import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lettings/import/row — single-row import. Mirrors the create-
 * property flow from /api/lettings/properties (Session 8c-iii) but driven
 * by a CSV row + the agent-confirmed column mapping. Same rollback-on-
 * tenancy-failure pattern: INSERT property, then INSERT tenancy if the
 * row implies one, DELETE the property if the tenancy insert fails.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIntOrNull(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.trim(), 10);
  return Number.isFinite(n) ? n : null;
}
function parseFloatOrNull(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.trim().replace(/[€£$,]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
function isoOrNull(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return ISO_DATE.test(t) ? t : null;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json({ ok: false, error: 'No agent profile' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    const row: Record<string, string> = body.row && typeof body.row === 'object' ? body.row : {};
    const mapping: Record<string, string> = body.mapping && typeof body.mapping === 'object' ? body.mapping : {};

    // Apply the mapping: build a target-field → value object
    const target: Record<string, string> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field || field === '_skip') continue;
      const v = row[header];
      if (typeof v === 'string' && v.trim() !== '') target[field] = v.trim();
    }

    const addressLine1 = target.address_line_1?.trim() ?? '';
    if (!addressLine1) {
      return NextResponse.json({ ok: false, error: 'Missing address' }, { status: 400 });
    }

    const { data: workspace } = await admin
      .from('agent_workspaces')
      .select('id')
      .eq('agent_id', agentProfile.id)
      .eq('mode', 'lettings')
      .limit(1)
      .maybeSingle();
    if (!workspace) {
      return NextResponse.json({ ok: false, error: 'No lettings workspace' }, { status: 500 });
    }

    const tenantName = target.tenant_name || null;
    const rentPcm = parseFloatOrNull(target.monthly_rent_eur);
    const isTenanted = !!tenantName || rentPcm != null;
    const status = isTenanted ? 'let' : 'vacant';

    const formattedAddress = [
      target.address_line_1, target.address_line_2, target.city, target.county, target.eircode,
    ].filter(Boolean).join(', ');

    const { data: inserted, error: propErr } = await admin
      .from('agent_letting_properties')
      .insert({
        workspace_id: workspace.id,
        agent_id: agentProfile.id,
        tenant_id: agentProfile.tenant_id,
        address: formattedAddress,
        address_line_1: addressLine1,
        address_line_2: target.address_line_2 || null,
        city: target.city || null,
        county: target.county || null,
        eircode: target.eircode || null,
        property_type: target.property_type || null,
        bedrooms: parseIntOrNull(target.bedrooms),
        bathrooms: parseIntOrNull(target.bathrooms),
        floor_area_sqm: parseFloatOrNull(target.floor_area_sqm),
        ber_rating: target.ber_rating ? target.ber_rating.toLowerCase() : null,
        rent_pcm: isTenanted ? rentPcm : null,
        status,
        source: 'csv_import',
      })
      .select('id')
      .single();
    if (propErr || !inserted) {
      console.error(`[lettings-import-row] property_insert_failed reason=${propErr?.message}`);
      return NextResponse.json({ ok: false, error: propErr?.message ?? 'Property insert failed' }, { status: 500 });
    }
    const propertyId = inserted.id as string;

    if (isTenanted) {
      try {
        const { error: tErr } = await admin.from('agent_tenancies').insert({
          letting_property_id: propertyId,
          workspace_id: workspace.id,
          agent_id: agentProfile.id,
          tenant_id: agentProfile.tenant_id,
          tenant_name: tenantName,
          tenant_email: target.tenant_email || null,
          tenant_phone: target.tenant_phone || null,
          rent_pcm: rentPcm,
          lease_start: isoOrNull(target.lease_start_date),
          lease_end: isoOrNull(target.lease_end_date),
          rtb_registration_number: target.rtb_registration_number || null,
          rtb_registered: !!target.rtb_registration_number,
          status: 'active',
          source: 'csv_import',
        });
        if (tErr) throw new Error(tErr.message);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        await admin.from('agent_letting_properties').delete().eq('id', propertyId).then(() => null, () => null);
        console.error(`[lettings-import-row] tenancy_failed_rolled_back reason=${reason}`);
        return NextResponse.json({ ok: false, error: reason }, { status: 500 });
      }
    }

    console.log(`[lettings-import-row] ok property_id=${propertyId} duration_ms=${Date.now() - started}`);
    return NextResponse.json({ ok: true, propertyId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-import-row] error duration_ms=${Date.now() - started} reason=${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
