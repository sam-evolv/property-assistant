import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { units, homeowners, developments } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const unitsData = await db
      .select({
        id: units.id,
        unit_number: units.unit_number,
        unit_uid: units.unit_uid,
        address_line_1: units.address_line_1,
        house_type_code: units.house_type_code,
        development_name: developments.name,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        homeowner_name: homeowners.name,
        homeowner_email: homeowners.email,
      })
      .from(units)
      .leftJoin(developments, eq(units.development_id, developments.id))
      .leftJoin(homeowners, eq(units.development_id, homeowners.development_id))
      .orderBy(units.unit_number);

    const formattedUnits = unitsData.map(unit => ({
      id: unit.id,
      unit_number: unit.unit_number,
      unit_uid: unit.unit_uid,
      address_line_1: unit.address_line_1,
      house_type_code: unit.house_type_code,
      development_name: unit.development_name || 'Unknown',
      purchaser_name: unit.purchaser_name,
      purchaser_email: unit.purchaser_email,
      homeowner: unit.homeowner_name ? {
        name: unit.homeowner_name,
        email: unit.homeowner_email || '',
      } : null,
      has_floor_plan: false,
      has_elevations: false,
      missing_docs: false,
    }));

    return NextResponse.json({ units: formattedUnits });
  } catch (error) {
    console.error('[API] /api/admin/units error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    );
  }
}
