import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { homeowners, units } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

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

    // Try QR token validation first, fall back to accepting unit UID as token
    let validatedUnitId: string | null = null;
    
    try {
      const payload = await validateQRToken(token);
      if (payload?.supabaseUnitId === unitUid) {
        validatedUnitId = unitUid;
      }
    } catch {
      // QR token validation failed - check if token is the unit UID itself (showhouse access)
    }
    
    // Allow unit UID as token for showhouse/demo access
    if (!validatedUnitId && token === unitUid) {
      validatedUnitId = unitUid;
      console.log('[Terms] Accepting unit UID as token for showhouse access:', unitUid);
    }
    
    if (!validatedUnitId) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Look up unit in PostgreSQL (units are stored in Drizzle, not Supabase)
    const unit = await db.query.units.findFirst({
      where: eq(units.id, unitUid),
      columns: { id: true },
    });
    
    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.unique_qr_token, unitUid),
      columns: {
        id: true,
        notices_terms_accepted_at: true,
      },
    });

    return NextResponse.json({
      termsAccepted: homeowner?.notices_terms_accepted_at !== null,
      acceptedAt: homeowner?.notices_terms_accepted_at || null,
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

    // Try QR token validation first, fall back to accepting unit UID as token
    let validatedUnitId: string | null = null;
    
    try {
      const payload = await validateQRToken(token);
      if (payload?.supabaseUnitId === unitUid) {
        validatedUnitId = unitUid;
      }
    } catch {
      // QR token validation failed - check if token is the unit UID itself (showhouse access)
    }
    
    // Allow unit UID as token for showhouse/demo access
    if (!validatedUnitId && token === unitUid) {
      validatedUnitId = unitUid;
      console.log('[Terms] Accepting unit UID as token for showhouse access:', unitUid);
    }
    
    if (!validatedUnitId) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Look up unit in PostgreSQL (units are stored in Drizzle, not Supabase)
    const unit = await db.query.units.findFirst({
      where: eq(units.id, unitUid),
      columns: { id: true },
    });
    
    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.unique_qr_token, unitUid),
      columns: { id: true },
    });

    if (!homeowner) {
      return NextResponse.json(
        { error: 'Homeowner record not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    await db
      .update(homeowners)
      .set({ notices_terms_accepted_at: now })
      .where(eq(homeowners.id, homeowner.id));

    console.log('[Terms] Homeowner', homeowner.id, 'accepted noticeboard terms at', now.toISOString());

    return NextResponse.json({
      success: true,
      acceptedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[Terms POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to record terms acceptance' },
      { status: 500 }
    );
  }
}
