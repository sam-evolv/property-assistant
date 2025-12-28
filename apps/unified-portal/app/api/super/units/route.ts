import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { resolveDevelopment } from '@/lib/development-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log('[API] /api/super/units - projectId:', projectId || 'all');
    
    // Resolve Supabase project ID to Drizzle development ID
    let drizzleDevelopmentId: string | null = null;
    if (projectId) {
      const resolved = await resolveDevelopment(projectId);
      drizzleDevelopmentId = resolved?.drizzleDevelopmentId || null;
      console.log('[API] /api/super/units - resolved to Drizzle development_id:', drizzleDevelopmentId);
    }

    let query = db
      .select({
        id: units.id,
        unit_number: units.unit_number,
        unit_uid: units.unit_uid,
        address_line_1: units.address_line_1,
        address_line_2: units.address_line_2,
        city: units.city,
        house_type_code: units.house_type_code,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        bedrooms: units.bedrooms,
        created_at: units.created_at,
        development_id: units.development_id,
        development_name: developments.name,
        development_address: developments.address,
      })
      .from(units)
      .leftJoin(developments, eq(units.development_id, developments.id))
      .orderBy(asc(developments.name), asc(units.address_line_1), asc(units.created_at));

    // Use resolved Drizzle development_id for filtering (not Supabase project_id)
    const unitsData = drizzleDevelopmentId
      ? await query.where(eq(units.development_id, drizzleDevelopmentId))
      : await query;

    const formattedUnits = unitsData.map((unit) => ({
      id: unit.id,
      unit_number: unit.unit_number,
      address: [unit.address_line_1, unit.address_line_2, unit.city].filter(Boolean).join(', ') || unit.unit_number,
      unit_type_name: unit.house_type_code || 'Unknown',
      house_type_code: unit.house_type_code || 'Unknown',
      project_name: unit.development_name || 'Unknown',
      project_address: unit.development_address || '',
      purchaser_name: unit.purchaser_name || null,
      purchaser_email: unit.purchaser_email || null,
      user_id: unit.purchaser_email ? 'registered' : null,
      bedrooms: unit.bedrooms || null,
      handover_date: null,
      has_snag_list: false,
      created_at: unit.created_at,
    }));

    console.log('[API] /api/super/units - returned:', formattedUnits.length, 'units');

    return NextResponse.json({ 
      units: formattedUnits,
      count: formattedUnits.length,
      projectId: projectId || null,
    });
  } catch (error: any) {
    console.error('[API] /api/super/units error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch units' },
      { status: 500 }
    );
  }
}
