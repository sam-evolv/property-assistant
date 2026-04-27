import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lettings/properties — creates property + optional tenancy +
 * provenance + lease document link. Supabase's JS client has no interactive
 * transactions, so we insert the property first and rollback via DELETE on
 * any subsequent failure (cascade FKs clean the children).
 */

type UiStatus = 'vacant' | 'tenanted' | 'off_market';
const STATUS_MAP: Record<UiStatus, string> = {
  vacant: 'vacant',
  tenanted: 'let',
  off_market: 'off_market',
};

const TENANCY_FIELDS = new Set([
  'tenantName', 'tenantEmail', 'tenantPhone', 'monthlyRentEur',
  'depositAmountEur', 'rentPaymentDay', 'leaseStartDate', 'leaseEndDate',
  'leaseType', 'rtbRegistrationNumber',
]);

const PROVENANCE_SOURCES = new Set([
  'manual', 'eircode', 'google_places', 'seai_register', 'lease_pdf_extraction',
]);

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    await requireRole(['developer', 'admin', 'super_admin']);

    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id, tenant_id, last_active_workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) {
      return NextResponse.json({ error: 'No agent profile for this user' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const status = body.status as UiStatus;
    if (!STATUS_MAP[status]) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const address = body.address ?? {};
    const property = body.property ?? {};
    const tenancy = (body.tenancy ?? null) as Record<string, unknown> | null;
    const leaseDocumentId = typeof body.leaseDocumentId === 'string' ? body.leaseDocumentId : null;
    const provenance = Array.isArray(body.provenance) ? body.provenance : [];
    const completenessScore =
      typeof body.completenessScore === 'number' ? body.completenessScore : 0;

    const missing: string[] = [];
    if (!address.line1) missing.push('address.line1');
    if (!property.propertyType) missing.push('property.propertyType');
    if (property.bedrooms == null) missing.push('property.bedrooms');
    if (status === 'tenanted') {
      if (!tenancy?.tenantName) missing.push('tenancy.tenantName');
      if (tenancy?.monthlyRentEur == null) missing.push('tenancy.monthlyRentEur');
      if (!tenancy?.leaseStartDate) missing.push('tenancy.leaseStartDate');
    }
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    let workspaceId: string | null = agentProfile.last_active_workspace_id ?? null;
    if (!workspaceId) {
      const { data: ws } = await admin
        .from('agent_workspaces')
        .select('id')
        .eq('agent_id', agentProfile.id)
        .eq('mode', 'lettings')
        .limit(1)
        .maybeSingle();
      workspaceId = ws?.id ?? null;
    }
    if (!workspaceId) {
      console.error(`[lettings-properties] no_workspace agent=${agentProfile.id}`);
      return NextResponse.json(
        { error: 'No lettings workspace found — contact support.' },
        { status: 500 },
      );
    }

    const formattedAddress = [
      address.line1, address.line2, address.town, address.county, address.eircode,
    ].filter(Boolean).join(', ');
    const redacted = formattedAddress.slice(0, 12) + '...';
    console.log(`[lettings-properties] save_start agent=${agentProfile.id} addr=${redacted}`);

    const { data: insertedProperty, error: propErr } = await admin
      .from('agent_letting_properties')
      .insert({
        workspace_id: workspaceId,
        agent_id: agentProfile.id,
        tenant_id: agentProfile.tenant_id,
        address: formattedAddress,
        address_line_1: address.line1,
        address_line_2: address.line2 ?? null,
        city: address.town ?? null,
        county: address.county ?? null,
        eircode: address.eircode ?? null,
        latitude: address.lat ?? null,
        longitude: address.lng ?? null,
        property_type: property.propertyType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms ?? null,
        floor_area_sqm: property.floorAreaSqm ?? null,
        year_built: property.yearBuilt ?? null,
        ber_rating: property.berRating ?? null,
        ber_cert_number: property.berCertNumber ?? null,
        ber_expiry_date: property.berExpiryDate ?? null,
        rent_pcm: status === 'tenanted' ? (tenancy?.monthlyRentEur as number | null) ?? null : null,
        status: STATUS_MAP[status],
        completeness_score: completenessScore,
        source: leaseDocumentId ? 'lease_pdf' : 'manual',
      })
      .select('id')
      .single();

    if (propErr || !insertedProperty) {
      console.error(`[lettings-properties] property_insert_failed reason=${propErr?.message}`);
      return NextResponse.json(
        { error: propErr?.message ?? 'Property insert failed' },
        { status: 500 },
      );
    }
    const propertyId = insertedProperty.id as string;

    try {
      let tenancyId: string | null = null;

      if (tenancy && status !== 'vacant') {
        const { data: insertedTenancy, error: tenancyErr } = await admin
          .from('agent_tenancies')
          .insert({
            letting_property_id: propertyId,
            workspace_id: workspaceId,
            agent_id: agentProfile.id,
            tenant_id: agentProfile.tenant_id,
            tenant_name: tenancy.tenantName,
            tenant_email: tenancy.tenantEmail ?? null,
            tenant_phone: tenancy.tenantPhone ?? null,
            rent_pcm: tenancy.monthlyRentEur ?? null,
            deposit_amount: tenancy.depositAmountEur ?? null,
            rent_payment_day: tenancy.rentPaymentDay ?? null,
            lease_start: tenancy.leaseStartDate ?? null,
            lease_end: tenancy.leaseEndDate ?? null,
            lease_type: tenancy.leaseType ?? null,
            rtb_registration_number: tenancy.rtbRegistrationNumber ?? null,
            rtb_registered: tenancy.rtbRegistrationNumber != null,
            status: 'active',
            source: leaseDocumentId ? 'lease_pdf' : 'manual',
            source_lease_document_id: leaseDocumentId,
          })
          .select('id')
          .single();
        if (tenancyErr || !insertedTenancy) {
          throw new Error(tenancyErr?.message ?? 'Tenancy insert failed');
        }
        tenancyId = insertedTenancy.id as string;
      }

      if (leaseDocumentId) {
        const { data: doc } = await admin
          .from('lettings_documents')
          .select('id, agent_id')
          .eq('id', leaseDocumentId)
          .maybeSingle();
        if (!doc) throw new Error('Lease document not found');
        if (doc.agent_id !== agentProfile.id) {
          throw new Error('Lease document not owned by this agent');
        }
        const { error: docErr } = await admin
          .from('lettings_documents')
          .update({
            letting_property_id: propertyId,
            tenancy_id: tenancyId,
            workspace_id: workspaceId,
          })
          .eq('id', leaseDocumentId);
        if (docErr) throw new Error(docErr.message);
      }

      const provRows = provenance
        .filter(
          (p: { fieldName?: unknown; source?: unknown }) =>
            typeof p.fieldName === 'string'
            && typeof p.source === 'string'
            && PROVENANCE_SOURCES.has(p.source),
        )
        .map((p: { fieldName: string; source: string; confidence?: number }) => {
          const isTenancy = TENANCY_FIELDS.has(p.fieldName);
          return {
            letting_property_id: isTenancy ? null : propertyId,
            tenancy_id: isTenancy ? tenancyId : null,
            field_name: p.fieldName,
            source: p.source,
            confidence: typeof p.confidence === 'number' ? p.confidence : null,
            extracted_at: new Date().toISOString(),
          };
        })
        .filter((r) => r.letting_property_id !== null || r.tenancy_id !== null);

      if (provRows.length > 0) {
        const { error: provErr } = await admin.from('lettings_field_provenance').insert(provRows);
        if (provErr) throw new Error(provErr.message);
      }

      console.log(
        `[lettings-properties] save_ok property_id=${propertyId} duration_ms=${Date.now() - started}`,
      );
      return NextResponse.json({ propertyId }, { status: 201 });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown error';
      console.error(
        `[lettings-properties] save_failed property_id=${propertyId} reason=${reason}`,
      );
      await admin.from('agent_letting_properties').delete().eq('id', propertyId).then(
        () => null,
        () => null,
      );
      return NextResponse.json({ error: reason }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED' || message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(
      `[lettings-properties] error duration_ms=${Date.now() - started} reason=${message}`,
    );
    return NextResponse.json({ error: 'Property save failed' }, { status: 500 });
  }
}
