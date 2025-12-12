import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { homeowners, units, developments } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { createClient } from '@supabase/supabase-js';

// Supabase client for legacy units lookup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get unit info from either database
async function getUnitInfo(unitUid: string): Promise<{
  id: string;
  tenant_id: string;
  development_id: string | null;
} | null> {
  // First try Drizzle units table
  const drizzleUnit = await db.query.units.findFirst({
    where: eq(units.id, unitUid),
    columns: { id: true, tenant_id: true, development_id: true },
  });

  if (drizzleUnit) {
    return {
      id: drizzleUnit.id,
      tenant_id: drizzleUnit.tenant_id,
      development_id: drizzleUnit.development_id,
    };
  }

  // Fall back to Supabase units table
  const { data: supabaseUnit, error } = await supabase
    .from('units')
    .select('id, address, project_id')
    .eq('id', unitUid)
    .single();

  if (error || !supabaseUnit) {
    return null;
  }

  // Get development info to find tenant_id
  if (supabaseUnit.project_id) {
    const dev = await db.query.developments.findFirst({
      where: eq(developments.id, supabaseUnit.project_id),
      columns: { id: true, tenant_id: true },
    });

    if (dev) {
      return {
        id: supabaseUnit.id,
        tenant_id: dev.tenant_id,
        development_id: dev.id,
      };
    }
  }

  // Try to match by address for Longview Park
  if (supabaseUnit.address?.toLowerCase().includes('longview')) {
    const longviewDev = await db.query.developments.findFirst({
      where: sql`LOWER(${developments.name}) LIKE '%longview%'`,
      columns: { id: true, tenant_id: true },
    });

    if (longviewDev) {
      return {
        id: supabaseUnit.id,
        tenant_id: longviewDev.tenant_id,
        development_id: longviewDev.id,
      };
    }
  }

  return null;
}

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

    // Look up unit in both databases (Drizzle first, then Supabase fallback)
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
      console.log('[Terms POST] Accepting unit UID as token for showhouse access:', unitUid);
    }
    
    if (!validatedUnitId) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Look up unit in both databases (Drizzle first, then Supabase fallback)
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
