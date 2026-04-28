import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/lettings/properties/[id] — single-call dashboard payload for the
 * property detail page: property + active tenancy + tenancy history +
 * documents + maintenance + provenance. RLS already scopes by agent; the
 * agent_id check below is a defensive double-check.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
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
    if (!agentProfile) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    console.log(`[lettings-property-detail] fetch_start id=${id}`);

    const { data: property } = await admin
      .from('agent_letting_properties')
      .select(
        'id, address, address_line_1, address_line_2, city, county, eircode, latitude, longitude, property_type, bedrooms, bathrooms, floor_area_sqm, year_built, ber_rating, ber_cert_number, ber_expiry_date, status, completeness_score, source, agent_id, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (!property || property.agent_id !== agentProfile.id) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const [tenanciesRes, documentsRes, maintenanceRes] = await Promise.all([
      admin
        .from('agent_tenancies')
        .select(
          'id, tenant_name, tenant_email, tenant_phone, rent_pcm, deposit_amount, rent_payment_day, lease_start, lease_end, lease_type, notice_period_days, rtb_registered, rtb_registration_number, status, source',
        )
        .eq('letting_property_id', id)
        .order('lease_start', { ascending: false }),
      admin
        .from('lettings_documents')
        .select('id, doc_type, original_filename, file_size_bytes, uploaded_at, ai_extraction_status')
        .eq('letting_property_id', id)
        .order('uploaded_at', { ascending: false }),
      admin
        .from('lettings_maintenance')
        .select('id, title, status, priority, category, reported_at, resolved_at')
        .eq('letting_property_id', id)
        .order('reported_at', { ascending: false }),
    ]);

    const tenancies = tenanciesRes.data ?? [];
    const activeTenancy = tenancies.find((t) => t.status === 'active') ?? null;

    // Provenance: rows for this property OR rows for its active tenancy.
    const { data: provenanceRows } = await admin
      .from('lettings_field_provenance')
      .select('field_name, source, confidence, extracted_at')
      .or(
        activeTenancy
          ? `letting_property_id.eq.${id},tenancy_id.eq.${activeTenancy.id}`
          : `letting_property_id.eq.${id}`,
      );

    console.log(
      `[lettings-property-detail] fetch_ok id=${id} duration_ms=${Date.now() - started}`,
    );

    return NextResponse.json({
      property: {
        id: property.id,
        address: property.address,
        addressLine1: property.address_line_1,
        addressLine2: property.address_line_2,
        city: property.city,
        county: property.county,
        eircode: property.eircode,
        latitude: property.latitude,
        longitude: property.longitude,
        propertyType: property.property_type,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        floorAreaSqm: property.floor_area_sqm,
        yearBuilt: property.year_built,
        berRating: property.ber_rating,
        berCertNumber: property.ber_cert_number,
        berExpiryDate: property.ber_expiry_date,
        status: property.status,
        completenessScore: property.completeness_score ?? 0,
        source: property.source,
        createdAt: property.created_at,
        updatedAt: property.updated_at,
      },
      activeTenancy: activeTenancy
        ? {
            id: activeTenancy.id,
            tenantName: activeTenancy.tenant_name,
            tenantEmail: activeTenancy.tenant_email,
            tenantPhone: activeTenancy.tenant_phone,
            rentPcm: activeTenancy.rent_pcm,
            depositAmount: activeTenancy.deposit_amount,
            // deposit_held column doesn't exist on agent_tenancies (it lives
            // on btr_* tables). 10c can wire to a new column if needed.
            depositHeld: null,
            rentPaymentDay: activeTenancy.rent_payment_day,
            leaseStart: activeTenancy.lease_start,
            leaseEnd: activeTenancy.lease_end,
            leaseType: activeTenancy.lease_type,
            noticePeriodDays: activeTenancy.notice_period_days,
            rtbRegistered: activeTenancy.rtb_registered,
            rtbRegistrationNumber: activeTenancy.rtb_registration_number,
            status: activeTenancy.status,
            source: activeTenancy.source,
          }
        : null,
      tenancyHistory: tenancies.map((t) => ({
        id: t.id,
        tenantName: t.tenant_name,
        leaseStart: t.lease_start,
        leaseEnd: t.lease_end,
        status: t.status,
        rentPcm: t.rent_pcm,
      })),
      documents: (documentsRes.data ?? []).map((d) => ({
        id: d.id,
        docType: d.doc_type,
        originalFilename: d.original_filename,
        fileSizeBytes: d.file_size_bytes,
        uploadedAt: d.uploaded_at,
        aiExtractionStatus: d.ai_extraction_status,
      })),
      maintenance: (maintenanceRes.data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        priority: m.priority,
        category: m.category,
        reportedAt: m.reported_at,
        resolvedAt: m.resolved_at,
      })),
      provenance: (provenanceRows ?? []).map((p) => ({
        fieldName: p.field_name,
        source: p.source,
        confidence: p.confidence,
        extractedAt: p.extracted_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[lettings-property-detail] error id=${id} duration_ms=${Date.now() - started} reason=${message}`,
    );
    return NextResponse.json({ error: 'Failed to fetch property' }, { status: 500 });
  }
}

const PROPERTY_TYPE_VALUES = new Set([
  'apartment', 'house_terraced', 'house_semi_detached', 'house_detached',
  'house_end_of_terrace', 'duplex', 'studio', 'bungalow', 'other',
]);
const BER_RATING_VALUES = new Set([
  'a1','a2','a3','b1','b2','b3','c1','c2','c3','d1','d2','e1','e2','f','g','exempt','pending',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PATCH /api/lettings/properties/[id] — partial update of editable property
 * fields. Each field is independently optional. The DB trigger recomputes
 * completeness_score on UPDATE; we read it back from the returned row.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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
    if (!agentProfile) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    const fields: string[] = [];

    const setNullableNumber = (key: string, dbKey: string, opts?: { min?: number; max?: number; integer?: boolean }) => {
      if (!(key in body)) return null;
      const v = body[key];
      if (v === null) { update[dbKey] = null; fields.push(key); return null; }
      if (typeof v !== 'number' || !Number.isFinite(v)) return `Invalid ${key}`;
      if (opts?.integer && !Number.isInteger(v)) return `${key} must be integer`;
      if (opts?.min != null && v < opts.min) return `${key} below min`;
      if (opts?.max != null && v > opts.max) return `${key} above max`;
      update[dbKey] = v; fields.push(key); return null;
    };

    if ('propertyType' in body) {
      const v = body.propertyType;
      if (v !== null && (typeof v !== 'string' || !PROPERTY_TYPE_VALUES.has(v))) {
        return NextResponse.json({ error: 'Invalid propertyType' }, { status: 400 });
      }
      update.property_type = v; fields.push('propertyType');
    }
    for (const err of [
      setNullableNumber('bedrooms', 'bedrooms', { integer: true, min: 0 }),
      setNullableNumber('bathrooms', 'bathrooms', { integer: true, min: 0 }),
      setNullableNumber('floorAreaSqm', 'floor_area_sqm', { min: 0 }),
      setNullableNumber('yearBuilt', 'year_built', { integer: true, min: 1700, max: 2030 }),
    ]) if (err) return NextResponse.json({ error: err }, { status: 400 });

    if ('berRating' in body) {
      const v = body.berRating;
      if (v === null) { update.ber_rating = null; fields.push('berRating'); }
      else if (typeof v === 'string') {
        const lower = v.toLowerCase();
        if (!BER_RATING_VALUES.has(lower)) return NextResponse.json({ error: 'Invalid berRating' }, { status: 400 });
        update.ber_rating = lower; fields.push('berRating');
      } else return NextResponse.json({ error: 'Invalid berRating' }, { status: 400 });
    }
    if ('berCertNumber' in body) {
      const v = body.berCertNumber;
      if (v !== null && typeof v !== 'string') return NextResponse.json({ error: 'Invalid berCertNumber' }, { status: 400 });
      update.ber_cert_number = v; fields.push('berCertNumber');
    }
    if ('berExpiryDate' in body) {
      const v = body.berExpiryDate;
      if (v !== null && (typeof v !== 'string' || !ISO_DATE.test(v))) {
        return NextResponse.json({ error: 'Invalid berExpiryDate' }, { status: 400 });
      }
      update.ber_expiry_date = v; fields.push('berExpiryDate');
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    console.log(`[lettings-property-detail] patch id=${id} fields=${fields.join(',')}`);

    const { data: updated, error: updErr } = await admin
      .from('agent_letting_properties')
      .update(update)
      .eq('id', id)
      .eq('agent_id', agentProfile.id)
      .select('id, property_type, bedrooms, bathrooms, floor_area_sqm, year_built, ber_rating, ber_cert_number, ber_expiry_date, completeness_score')
      .maybeSingle();
    if (updErr) {
      console.error(`[lettings-property-detail] patch_failed id=${id} reason=${updErr.message}`);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    console.log(`[lettings-property-detail] patch_ok id=${id} duration_ms=${Date.now() - started}`);
    return NextResponse.json({
      ok: true,
      completenessScore: updated.completeness_score ?? 0,
      updatedProperty: {
        propertyType: updated.property_type,
        bedrooms: updated.bedrooms,
        bathrooms: updated.bathrooms,
        floorAreaSqm: updated.floor_area_sqm,
        yearBuilt: updated.year_built,
        berRating: updated.ber_rating,
        berCertNumber: updated.ber_cert_number,
        berExpiryDate: updated.ber_expiry_date,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[lettings-property-detail] patch_error id=${id} duration_ms=${Date.now() - started} reason=${message}`,
    );
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }
}
