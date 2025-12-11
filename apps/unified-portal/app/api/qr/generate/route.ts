import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { db } from '@openhouse/db/client';
import { units } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://84141d02-f316-41eb-8d70-a45b1b91c63c-00-140og66wspdkl.riker.replit.dev';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get('unitId');
    const format = searchParams.get('format') || 'png';

    if (!unitId) {
      return NextResponse.json(
        { error: 'unitId is required' },
        { status: 400 }
      );
    }

    const unit = await db.query.units.findFirst({
      where: eq(units.id, unitId),
      columns: { id: true, address_line_1: true, purchaser_name: true },
    });

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const qrUrl = `${BASE_URL}/homes/${unitId}`;

    if (format === 'svg') {
      const svgString = await QRCode.toString(qrUrl, {
        type: 'svg',
        width: 300,
        margin: 2,
        color: { dark: '#1A1A1A', light: '#FFFFFF' }
      });

      return new NextResponse(svgString, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="qr-${unitId.slice(0, 8)}.svg"`,
        },
      });
    }

    const pngBuffer = await QRCode.toBuffer(qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#1A1A1A', light: '#FFFFFF' }
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="qr-${unitId.slice(0, 8)}.png"`,
      },
    });
  } catch (error) {
    console.error('[QR Generate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
