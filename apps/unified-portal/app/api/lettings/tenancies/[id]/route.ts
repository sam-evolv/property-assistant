import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEASE_TYPES = new Set(['fixed_term', 'periodic', 'part_4', 'further_part_4']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const TENANCY_RESPONSE_FIELDS =
  'id, letting_property_id, tenant_name, tenant_email, tenant_phone, rent_pcm, deposit_amount, rent_payment_day, lease_start, lease_end, lease_type, rtb_registered, rtb_registration_number, status, source';

function camelTenancy(t: Record<string, unknown>) {
  return {
    id: t.id as string,
    lettingPropertyId: t.letting_property_id,
    tenantName: t.tenant_name,
    tenantEmail: t.tenant_email,
    tenantPhone: t.tenant_phone,
    rentPcm: t.rent_pcm,
    depositAmount: t.deposit_amount,
    rentPaymentDay: t.rent_payment_day,
    leaseStart: t.lease_start,
    leaseEnd: t.lease_end,
    leaseType: t.lease_type,
    rtbRegistered: t.rtb_registered,
    rtbRegistrationNumber: t.rtb_registration_number,
    status: t.status,
    source: t.source,
  };
}

/** PATCH /api/lettings/tenancies/[id] — partial update of editable fields. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    const fields: string[] = [];

    const setStr = (key: string, dbKey: string) => {
      if (!(key in body)) return null;
      const v = body[key];
      if (v !== null && typeof v !== 'string') return `Invalid ${key}`;
      update[dbKey] = v; fields.push(key); return null;
    };
    const setNum = (key: string, dbKey: string, opts?: { integer?: boolean; min?: number; max?: number }) => {
      if (!(key in body)) return null;
      const v = body[key];
      if (v === null) { update[dbKey] = null; fields.push(key); return null; }
      if (typeof v !== 'number' || !Number.isFinite(v)) return `Invalid ${key}`;
      if (opts?.integer && !Number.isInteger(v)) return `${key} must be integer`;
      if (opts?.min != null && v < opts.min) return `${key} below min`;
      if (opts?.max != null && v > opts.max) return `${key} above max`;
      update[dbKey] = v; fields.push(key); return null;
    };
    const setDate = (key: string, dbKey: string) => {
      if (!(key in body)) return null;
      const v = body[key];
      if (v !== null && (typeof v !== 'string' || !ISO_DATE.test(v))) return `Invalid ${key}`;
      update[dbKey] = v; fields.push(key); return null;
    };

    for (const err of [
      setStr('tenantName', 'tenant_name'),
      setStr('tenantEmail', 'tenant_email'),
      setStr('tenantPhone', 'tenant_phone'),
      setNum('rentPcm', 'rent_pcm', { min: 0 }),
      setNum('depositAmount', 'deposit_amount', { min: 0 }),
      setNum('rentPaymentDay', 'rent_payment_day', { integer: true, min: 1, max: 31 }),
      setDate('leaseStartDate', 'lease_start'),
      setDate('leaseEndDate', 'lease_end'),
      setStr('rtbRegistrationNumber', 'rtb_registration_number'),
    ]) if (err) return NextResponse.json({ error: err }, { status: 400 });

    if ('rtbRegistrationNumber' in body) {
      update.rtb_registered = body.rtbRegistrationNumber != null;
    }

    if ('leaseType' in body) {
      const v = body.leaseType;
      if (v !== null && (typeof v !== 'string' || !LEASE_TYPES.has(v))) {
        return NextResponse.json({ error: 'Invalid leaseType' }, { status: 400 });
      }
      update.lease_type = v; fields.push('leaseType');
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    console.log(`[lettings-tenancy-detail] patch id=${id} fields=${fields.join(',')}`);

    const { data: updated } = await admin
      .from('agent_tenancies')
      .update(update)
      .eq('id', id)
      .eq('agent_id', agentProfile.id)
      .select(TENANCY_RESPONSE_FIELDS)
      .maybeSingle();
    if (!updated) return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });

    console.log(`[lettings-tenancy-detail] patch_ok id=${id} duration_ms=${Date.now() - started}`);
    return NextResponse.json({ ok: true, updatedTenancy: camelTenancy(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-tenancy-detail] patch_error id=${id} reason=${message}`);
    return NextResponse.json({ error: 'Failed to update tenancy' }, { status: 500 });
  }
}
