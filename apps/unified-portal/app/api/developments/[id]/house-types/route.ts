import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { houseTypes, developments } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

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
      // Development not in Drizzle - try to get tenant_id from Supabase projects table
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('tenant_id')
        .eq('id', developmentId)
        .single();

      if (projectError || !project) {
        console.error('[HouseTypes API] Development not found in Drizzle or Supabase:', developmentId);
        return NextResponse.json({ error: 'Development not found' }, { status: 404 });
      }

      tenantId = project.tenant_id;
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Could not determine tenant' }, { status: 400 });
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

    // No house types in Drizzle, try multiple sources in Supabase:
    // 1. First check unit_types table (primary source from imports)
    // 2. Then check units.house_type_code / units.house_type columns (legacy)

    const uniqueCodes = new Set<string>();

    // Source 1: unit_types table (this is where imported unit types go)
    const { data: unitTypes, error: unitTypesError } = await supabaseAdmin
      .from('unit_types')
      .select('id, name')
      .eq('project_id', developmentId);

    if (unitTypesError) {
      console.error('[HouseTypes API] Error fetching unit_types:', unitTypesError);
    } else {
      console.log(`[HouseTypes API] Found ${unitTypes?.length || 0} unit_types for development ${developmentId}`);
      (unitTypes || []).forEach((ut: any) => {
        if (ut.name && typeof ut.name === 'string' && ut.name.trim()) {
          uniqueCodes.add(ut.name.trim());
        }
      });
    }

    // Source 2: units table columns (legacy/fallback)
    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('house_type_code, house_type')
      .eq('project_id', developmentId);

    if (error) {
      console.error('[HouseTypes API] Error fetching units:', error);
    } else {
      console.log(`[HouseTypes API] Fetched ${units?.length || 0} units for development ${developmentId}`);
      // Extract unique house type codes - check both column names
      (units || []).forEach((unit: any) => {
        // Prefer house_type_code, fall back to house_type
        const code = unit.house_type_code || unit.house_type;
        if (code && typeof code === 'string' && code.trim()) {
          uniqueCodes.add(code.trim());
        }
      });
    }

    console.log(`[HouseTypes API] Found ${uniqueCodes.size} unique house type codes from all sources:`, Array.from(uniqueCodes));

    if (uniqueCodes.size === 0) {
      console.log(`[HouseTypes API] No house types found for development ${developmentId}`);
      return NextResponse.json({ houseTypes: [] });
    }

    // Create house types in Drizzle for each unique code
    const createdHouseTypes = [];
    for (const code of uniqueCodes) {
      try {
        const [created] = await db.insert(houseTypes).values({
          tenant_id: tenantId,
          development_id: developmentId,
          house_type_code: code,
        }).returning();

        createdHouseTypes.push({
          id: created.id,
          house_type_code: created.house_type_code,
          development_id: created.development_id,
          bedrooms: created.bedrooms,
          total_floor_area_sqm: created.total_floor_area_sqm,
        });

        console.log(`[HouseTypes API] Created house type ${code} with ID ${created.id}`);
      } catch (insertError: any) {
        // If it's a duplicate key error, the house type was created by another request
        if (insertError.code === '23505') {
          console.log(`[HouseTypes API] House type ${code} already exists, fetching it`);
          const existing = await db.query.houseTypes.findFirst({
            where: and(
              eq(houseTypes.development_id, developmentId),
              eq(houseTypes.house_type_code, code)
            ),
          });
          if (existing) {
            createdHouseTypes.push({
              id: existing.id,
              house_type_code: existing.house_type_code,
              development_id: existing.development_id,
              bedrooms: existing.bedrooms,
              total_floor_area_sqm: existing.total_floor_area_sqm,
            });
          }
        } else {
          console.error(`[HouseTypes API] Error creating house type ${code}:`, insertError);
        }
      }
    }

    const sortedHouseTypes = createdHouseTypes.sort((a, b) =>
      a.house_type_code.localeCompare(b.house_type_code)
    );

    console.log(`[HouseTypes API] Created/found ${sortedHouseTypes.length} house types for development ${developmentId}`);

    return NextResponse.json({ houseTypes: sortedHouseTypes });
  } catch (error) {
    console.error('[HouseTypes API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch house types' },
      { status: 500 }
    );
  }
}
