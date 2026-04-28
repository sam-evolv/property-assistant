import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEASE_TYPES = new Set(['fixed_term', 'periodic', 'part_4', 'further_part_4']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/lettings/tenancies — creates a new active tenancy on a property
 * the agent owns and flips the parent property's status to 'let'. Rolls
 * back the tenancy insert if the property update fails.
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const lettingPropertyId = body.lettingPropertyId;
    const tenantName = body.tenantName;
    const rentPcm = body.rentPcm;
    const leaseStartDate = body.leaseStartDate;

    const missing: string[] = [];
    if (typeof lettingPropertyId !== 'string') missing.push('lettingPropertyId');
    if (typeof tenantName !== 'string' || !tenantName.trim()) missing.push('tenantName');
    if (typeof rentPcm !== 'number' || !Number.isFinite(rentPcm)) missing.push('rentPcm');
    if (typeof leaseStartDate !== 'string' || !ISO_DATE.test(leaseStartDate)) missing.push('leaseStartDate');
    if (missing.length) {
      return NextResponse.json({ error: `Missing/invalid: ${missing.join(', ')}` }, { status: 400 });
    }

    const optDate = (k: string): string | null | undefined => {
      const v = body[k];
      if (v == null) return null;
      if (typeof v !== 'string' || !ISO_DATE.test(v)) return undefined;
      return v;
    };
    const leaseEndDate = optDate('leaseEndDate');
    if (leaseEndDate === undefined) return NextResponse.json({ error: 'Invalid leaseEndDate' }, { status: 400 });

    const leaseType = body.leaseType ?? null;
    if (leaseType !== null && (typeof leaseType !== 'string' || !LEASE_TYPES.has(leaseType))) {
      return NextResponse.json({ error: 'Invalid leaseType' }, { status: 400 });
    }

    const { data: property } = await admin
      .from('agent_letting_properties')
      .select('id, agent_id, workspace_id')
      .eq('id', lettingPropertyId)
      .maybeSingle();
    if (!property || property.agent_id !== agentProfile.id) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    console.log(`[lettings-tenancy-create] start property=${lettingPropertyId}`);

    const { data: insertedTenancy, error: tErr } = await admin
      .from('agent_tenancies')
      .insert({
        letting_property_id: lettingPropertyId,
        workspace_id: property.workspace_id,
        agent_id: agentProfile.id,
        tenant_id: agentProfile.tenant_id,
        tenant_name: tenantName.trim(),
        tenant_email: typeof body.tenantEmail === 'string' ? body.tenantEmail : null,
        tenant_phone: typeof body.tenantPhone === 'string' ? body.tenantPhone : null,
        rent_pcm: rentPcm,
        deposit_amount: typeof body.depositAmount === 'number' ? body.depositAmount : null,
        rent_payment_day: typeof body.rentPaymentDay === 'number' && Number.isInteger(body.rentPaymentDay) ? body.rentPaymentDay : null,
        lease_start: leaseStartDate,
        lease_end: leaseEndDate,
        lease_type: leaseType,
        rtb_registration_number: typeof body.rtbRegistrationNumber === 'string' ? body.rtbRegistrationNumber : null,
        rtb_registered: typeof body.rtbRegistrationNumber === 'string',
        status: 'active',
        source: 'manual',
      })
      .select('id, status, lease_start, lease_end, tenant_name, rent_pcm')
      .single();
    if (tErr || !insertedTenancy) {
      console.error(`[lettings-tenancy-create] insert_failed reason=${tErr?.message}`);
      return NextResponse.json({ error: tErr?.message ?? 'Tenancy insert failed' }, { status: 500 });
    }

    const { data: updatedProperty, error: pErr } = await admin
      .from('agent_letting_properties')
      .update({ status: 'let' })
      .eq('id', lettingPropertyId)
      .select('id, status, completeness_score')
      .single();
    if (pErr || !updatedProperty) {
      // Rollback the tenancy insert
      await admin.from('agent_tenancies').delete().eq('id', insertedTenancy.id);
      console.error(`[lettings-tenancy-create] property_update_failed_rolled_back reason=${pErr?.message}`);
      return NextResponse.json({ error: pErr?.message ?? 'Property update failed' }, { status: 500 });
    }

    console.log(`[lettings-tenancy-create] ok tenancy=${insertedTenancy.id} duration_ms=${Date.now() - started}`);
    return NextResponse.json({
      ok: true,
      newTenancy: { id: insertedTenancy.id, tenantName: insertedTenancy.tenant_name, rentPcm: insertedTenancy.rent_pcm, leaseStart: insertedTenancy.lease_start, leaseEnd: insertedTenancy.lease_end, status: insertedTenancy.status },
      updatedProperty: { id: updatedProperty.id, status: updatedProperty.status, completenessScore: updatedProperty.completeness_score ?? 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-tenancy-create] error reason=${message}`);
    return NextResponse.json({ error: 'Failed to create tenancy' }, { status: 500 });
  }
}
