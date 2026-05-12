export const dynamic = 'force-dynamic'

/**
 * GET /api/care/installations: List installations for tenant
 * POST /api/care/installations: Create new installation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CareAuthError,
  careAuthErrorToResponse,
  requireCareTenantSession,
} from '@/lib/care/require-care-session';

/**
 * GET: List installations for a development (scoped to caller's tenant)
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, session } = await requireCareTenantSession();
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    if (!developmentId) {
      return NextResponse.json(
        { error: 'developmentId required' },
        { status: 400 },
      );
    }

    const { data: installations, error } = await supabase
      .from('installations')
      .select('*')
      .eq('development_id', developmentId)
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      installations,
      count: installations?.length || 0,
    });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json(
      { error: 'Failed to fetch installations' },
      { status: 500 },
    );
  }
}

/**
 * POST: Create new installation under caller's tenant
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, session } = await requireCareTenantSession();
    const body = await request.json();
    const {
      developmentId,
      systemType,
      systemModel,
      capacity,
      serialNumber,
      installationDate,
      warrantyExpiry,
      homeownerEmail,
      componentSpecs,
      performanceBaseline,
      telemetrySource,
    } = body;

    if (!developmentId || !systemType || !systemModel || !serialNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Verify the development belongs to the caller's tenant before inserting.
    const { data: dev, error: devError } = await supabase
      .from('developments')
      .select('tenant_id')
      .eq('id', developmentId)
      .eq('tenant_id', session.tenantId)
      .maybeSingle();

    if (devError || !dev) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 },
      );
    }

    const qrCode = generateQRCode(developmentId, serialNumber);

    const { data: installation, error: insertError } = await supabase
      .from('installations')
      .insert({
        tenant_id: session.tenantId,
        development_id: developmentId,
        system_type: systemType,
        system_model: systemModel,
        capacity,
        serial_number: serialNumber,
        installation_date: installationDate,
        warranty_expiry: warrantyExpiry,
        homeowner_email: homeownerEmail,
        component_specs: componentSpecs || {},
        performance_baseline: performanceBaseline || {},
        telemetry_source: telemetrySource || 'mock',
        qr_code: qrCode,
        handover_date: new Date().toISOString(),
        adoption_status: 'pending',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      installation,
      qrCode,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/care/${installation.id}?qr=${qrCode}`,
    });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json(
      { error: 'Failed to create installation' },
      { status: 500 },
    );
  }
}

function generateQRCode(developmentId: string, serialNumber: string): string {
  const timestamp = Date.now();
  const hash = Buffer.from(`${developmentId}:${serialNumber}:${timestamp}`)
    .toString('base64')
    .substring(0, 12);
  return `CARE_${hash.toUpperCase()}`;
}
