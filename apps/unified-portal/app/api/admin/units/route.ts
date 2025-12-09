import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { units, developments, qr_tokens } from '@openhouse/db/schema';
import { eq, sql, and, isNotNull } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const unitsData = await db
      .select({
        id: units.id,
        unit_number: units.unit_number,
        unit_uid: units.unit_uid,
        address_line_1: units.address_line_1,
        address_line_2: units.address_line_2,
        city: units.city,
        house_type_code: units.house_type_code,
        property_type: units.property_type,
        bedrooms: units.bedrooms,
        development_name: developments.name,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        purchaser_phone: units.purchaser_phone,
        token_used: qr_tokens.used_at,
      })
      .from(units)
      .leftJoin(developments, eq(units.development_id, developments.id))
      .leftJoin(qr_tokens, eq(units.id, qr_tokens.unit_id))
      .orderBy(developments.name, units.unit_number);

    const formattedUnits = unitsData.map(unit => {
      const fullAddress = [unit.address_line_1, unit.address_line_2, unit.city]
        .filter(Boolean)
        .join(', ');
      
      const isOnboarded = !!unit.token_used;
      
      return {
        id: unit.id,
        unit_number: unit.unit_number,
        unit_uid: unit.unit_uid,
        address: fullAddress || unit.address_line_1,
        house_type_code: unit.house_type_code,
        property_type: unit.property_type,
        bedrooms: unit.bedrooms,
        development_name: unit.development_name || 'Unknown',
        purchaser_name: unit.purchaser_name,
        purchaser_email: unit.purchaser_email,
        purchaser_phone: unit.purchaser_phone,
        homeowner: unit.purchaser_name ? {
          name: unit.purchaser_name,
          email: unit.purchaser_email || '',
          onboarded: isOnboarded,
        } : null,
        has_floor_plan: false,
        has_elevations: false,
        missing_docs: false,
      };
    });

    return NextResponse.json({ units: formattedUnits });
  } catch (error) {
    console.error('[API] /api/admin/units error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    );
  }
}
