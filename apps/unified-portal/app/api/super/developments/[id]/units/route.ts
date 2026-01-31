import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { units, unitSalesPipeline } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin']);

    const developmentId = params.id;

    const unitsData = await db
      .select({
        id: units.id,
        unit_number: units.unit_number,
        address: units.address_line_1,
        bedrooms: units.bedrooms,
        house_type_code: units.house_type_code,
      })
      .from(units)
      .where(eq(units.development_id, developmentId))
      .orderBy(units.unit_number);

    let pipelineUnitIds: Set<string> = new Set();
    try {
      const pipelineData = await db
        .select({ unit_id: unitSalesPipeline.unit_id })
        .from(unitSalesPipeline)
        .where(sql`${unitSalesPipeline.unit_id} IN (${sql.raw(unitsData.map(u => `'${u.id}'`).join(',') || "''")})`);
      
      pipelineUnitIds = new Set(pipelineData.map(p => p.unit_id).filter(Boolean) as string[]);
    } catch (e) {
      console.log('Pipeline query failed, assuming no pipeline data');
    }

    const formattedUnits = unitsData.map((unit) => ({
      id: unit.id,
      unit_number: unit.unit_number || '',
      address: unit.address || '',
      bedrooms: unit.bedrooms || 0,
      house_type_code: unit.house_type_code || '',
      has_pipeline: pipelineUnitIds.has(unit.id),
    }));

    return NextResponse.json({ units: formattedUnits });
  } catch (error: any) {
    console.error('[Super Development Units API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}
