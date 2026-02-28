/**
 * GET /api/care/installations — List installations for tenant
 * POST /api/care/installations — Create new installation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET: List installations for a development
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    if (!developmentId) {
      return NextResponse.json(
        { error: 'developmentId required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: installations, error } = await supabase
      .from('installations')
      .select('*')
      .eq('development_id', developmentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      installations,
      count: installations?.length || 0,
    });
  } catch (error) {
    console.error('[Care API] GET /installations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch installations' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create new installation
 */
export async function POST(request: NextRequest) {
  try {
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

    // Validation
    if (!developmentId || !systemType || !systemModel || !serialNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get tenant from development
    const { data: dev, error: devError } = await supabase
      .from('developments')
      .select('tenant_id')
      .eq('id', developmentId)
      .single();

    if (devError || !dev) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 }
      );
    }

    // Generate QR code
    const qrCode = generateQRCode(developmentId, serialNumber);

    // Insert installation
    const { data: installation, error: insertError } = await supabase
      .from('installations')
      .insert({
        tenant_id: dev.tenant_id,
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

    // Return with QR code
    return NextResponse.json({
      installation,
      qrCode,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/care/${installation.id}?qr=${qrCode}`,
    });
  } catch (error) {
    console.error('[Care API] POST /installations error:', error);
    return NextResponse.json(
      { error: 'Failed to create installation' },
      { status: 500 }
    );
  }
}

function generateQRCode(developmentId: string, serialNumber: string): string {
  // In production: generate actual QR code with encoded URL
  // For demo: just a unique identifier
  const timestamp = Date.now();
  const hash = Buffer.from(`${developmentId}:${serialNumber}:${timestamp}`).toString('base64').substring(0, 12);
  return `CARE_${hash.toUpperCase()}`;
}
