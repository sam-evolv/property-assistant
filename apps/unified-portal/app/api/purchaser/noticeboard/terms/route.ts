import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { homeowners } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';
import { getUnitInfo } from '@openhouse/api';

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

    const unit = await getUnitInfo(unitUid);
    
    // For terms check, we don't require the unit - just return false if not found
    if (!unit) {
      return NextResponse.json({
        termsAccepted: false,
        acceptedAt: null,
      });
    }

    let homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.unique_qr_token, unitUid),
      columns: {
        id: true,
        notices_terms_accepted_at: true,
      },
    });

    // If no homeowner exists with this QR token, check if one was created for showhouse
    if (!homeowner) {
      // Return false - no terms accepted yet, but not an error
      return NextResponse.json({
        termsAccepted: false,
        acceptedAt: null,
      });
    }

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

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await getUnitInfo(unitUid);
    
    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    let homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.unique_qr_token, unitUid),
      columns: { id: true },
    });

    const now = new Date();
    
    // If no homeowner exists, create one for this showhouse/demo user
    if (!homeowner) {
      if (!unit.tenant_id || !unit.development_id) {
        return NextResponse.json(
          { error: 'Could not determine tenant/development for unit' },
          { status: 404 }
        );
      }
      
      // Create a new homeowner record linked to this unit
      const [newHomeowner] = await db.insert(homeowners).values({
        tenant_id: unit.tenant_id,
        development_id: unit.development_id,
        unique_qr_token: unitUid,
        name: 'Showhouse User',
        email: `showhouse-${unitUid.slice(0, 8)}@demo.local`,
        notices_terms_accepted_at: now,
      }).returning({ id: homeowners.id });
      
      console.log('[Terms POST] Created new homeowner', newHomeowner.id, 'for showhouse unit', unitUid);
      
      return NextResponse.json({
        success: true,
        acceptedAt: now.toISOString(),
      });
    }

    await db
      .update(homeowners)
      .set({ notices_terms_accepted_at: now })
      .where(eq(homeowners.id, homeowner.id));

    console.log('[Terms POST] Homeowner', homeowner.id, 'accepted noticeboard terms at', now.toISOString());

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
