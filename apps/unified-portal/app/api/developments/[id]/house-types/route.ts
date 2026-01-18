import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { houseTypes, developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { id: developmentId } = await params;

    if (!developmentId) {
      return NextResponse.json({ error: 'Development ID required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // First, try to get tenant_id from Drizzle developments table
    let tenantId: string | null = null;

    const dev = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
    });

    if (dev) {
      tenantId = dev.tenant_id;
    } else {
      // Development not in Drizzle - try to get from Supabase projects table
      // Note: Supabase projects use 'organization_id' instead of 'tenant_id'
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('organization_id')
        .eq('id', developmentId)
        .single();

      if (projectError || !project) {
        console.error('[HouseTypes API] Development not found in Drizzle or Supabase:', developmentId, projectError);
        return NextResponse.json({ error: 'Development not found' }, { status: 404 });
      }

      // Map organization_id to tenantId (they serve the same purpose)
      tenantId = project.organization_id;
    }

    // tenantId might be null for some projects - that's OK, we can still proceed
    // to fetch house types. We just won't be able to create new ones in Drizzle.
    if (!tenantId) {
      console.log('[HouseTypes API] No tenant_id found, proceeding without tenant context');
    }

    // Check if we have house types in Drizzle for this development
    const existingHouseTypes = await db.query.houseTypes.findMany({
      where: eq(houseTypes.development_id, developmentId),
    });

    if (existingHouseTypes.length > 0) {
      // We have house types in Drizzle, return them
      const result = existingHouseTypes.map(ht => ({
        id: ht.id,
        house_type_code: ht.house_type_code,
        development_id: ht.development_id,
        bedrooms: ht.bedrooms,
        total_floor_area_sqm: ht.total_floor_area_sqm,
      }));

      console.log(`[HouseTypes API] Found ${result.length} existing house types in Drizzle for development ${developmentId}`);
      return NextResponse.json({ houseTypes: result });
    }

    // No house types in Drizzle, fetch from Supabase unit_types table
    // This is the primary/only source - units reference unit_types via unit_type_id foreign key
    console.log(`[HouseTypes API] Fetching unit_types for development ${developmentId}`);

    const { data: unitTypes, error: unitTypesError } = await supabaseAdmin
      .from('unit_types')
      .select('id, name')
      .eq('project_id', developmentId)
      .order('name');

    if (unitTypesError) {
      console.error('[HouseTypes API] Error fetching unit_types:', unitTypesError);
      return NextResponse.json({ error: 'Failed to fetch unit types' }, { status: 500 });
    }

    console.log(`[HouseTypes API] Found ${unitTypes?.length || 0} unit_types for development ${developmentId}:`,
      unitTypes?.map(ut => ut.name) || []);

    // If we found unit types in Supabase, return them directly as virtual house types
    // (We use the unit_types.id as the house type id for consistency)
    if (unitTypes && unitTypes.length > 0) {
      const houseTypesFromUnitTypes = unitTypes
        .filter((ut: any) => ut.name && typeof ut.name === 'string' && ut.name.trim())
        .map((ut: any) => ({
          id: ut.id, // Use the actual unit_type id
          house_type_code: ut.name.trim(),
          development_id: developmentId,
          bedrooms: null,
          total_floor_area_sqm: null,
        }));

      console.log(`[HouseTypes API] Returning ${houseTypesFromUnitTypes.length} house types from unit_types table`);
      return NextResponse.json({ houseTypes: houseTypesFromUnitTypes });
    }

    // No unit_types found - check if there are any units at all
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('project_id', developmentId)
      .limit(1);

    if (unitsError) {
      console.error('[HouseTypes API] Error checking units:', unitsError);
    }

    console.log(`[HouseTypes API] Development ${developmentId} has ${units?.length || 0} units but no unit_types`);

    // No unit types found for this development
    return NextResponse.json({ houseTypes: [] });
  } catch (error) {
    console.error('[HouseTypes API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch house types' },
      { status: 500 }
    );
  }
}
