import { NextRequest, NextResponse } from 'next/server';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      termsAccepted: false,
      acceptedAt: null,
      message: 'Terms acceptance is managed client-side',
    });
  } catch (error) {
    console.error('[Terms GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to check terms status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    console.log('[Terms POST] User accepted noticeboard terms for unit:', unitUid);

    return NextResponse.json({
      success: true,
      acceptedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Terms POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to record terms acceptance' },
      { status: 500 }
    );
  }
}
