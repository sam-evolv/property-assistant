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
