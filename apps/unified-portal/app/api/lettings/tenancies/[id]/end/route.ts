import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/lettings/tenancies/[id]/end — marks an active tenancy ended on
 * the given date and flips the parent property to status='vacant'.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const started = Date.now();
  const id = params.id;
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });

    const body = await req.json().catch(() => null);
    const leaseEndDate = body?.leaseEndDate;
    if (typeof leaseEndDate !== 'string' || !ISO_DATE.test(leaseEndDate)) {
      return NextResponse.json({ error: 'leaseEndDate (YYYY-MM-DD) is required' }, { status: 400 });
    }

    const { data: existing } = await admin
      .from('agent_tenancies')
      .select('id, letting_property_id, agent_id, status')
      .eq('id', id)
      .maybeSingle();
    if (!existing || existing.agent_id !== agentProfile.id) {
      return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
    }
    if (existing.status === 'ended') {
      return NextResponse.json({ error: 'Tenancy already ended' }, { status: 409 });
    }

    console.log(`[lettings-tenancy-end] start id=${id} property=${existing.letting_property_id}`);

    const { data: updatedTenancy, error: tErr } = await admin
      .from('agent_tenancies')
      .update({ status: 'ended', lease_end: leaseEndDate })
      .eq('id', id)
      .select('id, status, lease_end')
      .single();
    if (tErr || !updatedTenancy) {
      console.error(`[lettings-tenancy-end] tenancy_update_failed reason=${tErr?.message}`);
      return NextResponse.json({ error: tErr?.message ?? 'Tenancy update failed' }, { status: 500 });
    }

    const { data: updatedProperty, error: pErr } = await admin
      .from('agent_letting_properties')
      .update({ status: 'vacant' })
      .eq('id', existing.letting_property_id)
      .select('id, status, completeness_score')
      .single();
    if (pErr) {
      console.error(`[lettings-tenancy-end] property_update_failed reason=${pErr.message}`);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    console.log(`[lettings-tenancy-end] ok id=${id} duration_ms=${Date.now() - started}`);
    return NextResponse.json({
      ok: true,
      updatedTenancy: { id: updatedTenancy.id, status: updatedTenancy.status, leaseEnd: updatedTenancy.lease_end },
      updatedProperty: { id: updatedProperty.id, status: updatedProperty.status, completenessScore: updatedProperty.completeness_score ?? 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-tenancy-end] error id=${id} reason=${message}`);
    return NextResponse.json({ error: 'Failed to end tenancy' }, { status: 500 });
  }
}
