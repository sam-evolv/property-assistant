export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL environment variable is required');
  }
  return baseUrl.trim().replace(/\/+$/, '');
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const BASE_URL = getBaseUrl();
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');
    const format = searchParams.get('format') || 'png';

    const supabase = getSupabaseAdmin();

    // Fetch units - optionally filter by development
    let query = supabase
      .from('units')
      .select('id, address_line_1, purchaser_name, unit_number')
      .order('address_line_1', { ascending: true });

    if (developmentId && developmentId !== 'all') {
      query = query.eq('project_id', developmentId);
    }

    const { data: units, error } = await query;

    if (error) {
      console.error('[QR Bulk] Error fetching units:', error);
      return NextResponse.json(
        { error: 'Failed to fetch units' },
        { status: 500 }
      );
    }

    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: 'No units found' },
        { status: 404 }
      );
    }

    // Create ZIP file
    const zip = new JSZip();

    // Generate QR codes for each unit
    for (const unit of units) {
      const qrUrl = `${BASE_URL}/homes/${unit.id}`;

      // Create a safe filename
      const name = unit.purchaser_name || unit.unit_number || unit.id.slice(0, 8);
      const address = unit.address_line_1 || '';
      const safeName = `${name}-${address}`
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 50);

      try {
        if (format === 'svg') {
          const svgString = await QRCode.toString(qrUrl, {
            type: 'svg',
            width: 300,
            margin: 2,
            color: { dark: '#1A1A1A', light: '#FFFFFF' }
          });
          zip.file(`${safeName}.svg`, svgString);
        } else {
          const pngBuffer = await QRCode.toBuffer(qrUrl, {
            width: 400,
            margin: 2,
            color: { dark: '#1A1A1A', light: '#FFFFFF' }
          });
          zip.file(`${safeName}.png`, pngBuffer);
        }
      } catch (qrError) {
        console.error(`[QR Bulk] Error generating QR for unit ${unit.id}:`, qrError);
        // Continue with other units
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = developmentId && developmentId !== 'all'
      ? `qr-codes-${developmentId.slice(0, 8)}-${timestamp}.zip`
      : `qr-codes-all-${timestamp}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[QR Bulk] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR codes' },
      { status: 500 }
    );
  }
}
