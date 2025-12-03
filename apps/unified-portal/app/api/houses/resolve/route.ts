import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { units, developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    
    if (!code) {
      return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
    }

    // Validate token (REQUIRED for all requests)
    const payload = await validateQRToken(token);
    if (!payload) {
      console.error('[HOUSES RESOLVE] Invalid or expired token');
      return NextResponse.json(
        { error: 'Invalid or expired QR code' },
        { status: 401 }
      );
    }
    
    // Verify the token's unitUid matches the requested code
    if (payload.unitUid !== code) {
      console.error('[HOUSES RESOLVE] Token unitUid mismatch');
      return NextResponse.json(
        { error: 'Invalid QR code for this unit' },
        { status: 401 }
      );
    }
    
    console.log(`[HOUSES RESOLVE] Token validated for unit ${code}`);

    // Fetch unit data
    const unit = await db
      .select({
        id: units.id,
        development_id: units.development_id,
        development_code: units.development_code,
        unit_uid: units.unit_uid,
        unit_number: units.unit_number,
        address_line_1: units.address_line_1,
        eircode: units.eircode,
        house_type_code: units.house_type_code,
        bedrooms: units.bedrooms,
        floor_area_m2: units.floor_area_m2,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        mrpn: units.mrpn,
        electricity_account: units.electricity_account,
        esb_eirgrid_number: units.esb_eirgrid_number,
        latitude: units.latitude,
        longitude: units.longitude,
        metadata: units.metadata,
        tenant_id: units.tenant_id,
      })
      .from(units)
      .where(eq(units.unit_uid, code))
      .limit(1);

    if (!unit || unit.length === 0) {
      return NextResponse.json({ error: 'House not found' }, { status: 404 });
    }

    const house = unit[0];

    // Fetch development data
    const dev = await db
      .select()
      .from(developments)
      .where(eq(developments.id, house.development_id))
      .limit(1);

    return NextResponse.json({
      house_id: house.id,
      development_id: house.development_id,
      development_code: house.development_code,
      development_name: dev[0]?.name,
      development_logo_url: dev[0]?.logo_url,
      development_system_instructions: dev[0]?.system_instructions,
      unit_uid: house.unit_uid,
      unit_number: house.unit_number,
      address: house.address_line_1,
      eircode: house.eircode,
      house_type: house.house_type_code,
      bedrooms: house.bedrooms,
      floor_area_m2: house.floor_area_m2,
      purchaser_name: house.purchaser_name,
      purchaser_email: house.purchaser_email,
      mrpn: house.mrpn,
      electricity_account: house.electricity_account,
      esb_eirgrid_number: house.esb_eirgrid_number,
      latitude: house.latitude ? parseFloat(house.latitude) : null,
      longitude: house.longitude ? parseFloat(house.longitude) : null,
      metadata: house.metadata,
      tenant_id: house.tenant_id,
    });
  } catch (error: any) {
    console.error('[HOUSES RESOLVE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
