export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

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
    await requireRole(['developer', 'admin', 'super_admin']);
    const { id: developmentId } = await params;

    if (!developmentId) {
      return NextResponse.json({ error: 'Development ID required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify the project exists in Supabase
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('id', developmentId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    // Get unit types directly from the unit_types table
    // This is where house types are stored - units reference them via unit_type_id
    const { data: unitTypes, error: unitTypesError } = await supabaseAdmin
      .from('unit_types')
      .select('id, name')
      .eq('project_id', developmentId)
      .order('name');

    if (unitTypesError) {
      return NextResponse.json({ error: 'Failed to fetch unit types' }, { status: 500 });
    }

    // Return unit types as house types
    if (unitTypes && unitTypes.length > 0) {
      const houseTypes = unitTypes
        .filter((ut: any) => ut.name && typeof ut.name === 'string' && ut.name.trim())
        .map((ut: any) => ({
          id: ut.id,
          house_type_code: ut.name.trim(),
          development_id: developmentId,
          bedrooms: null,
          total_floor_area_sqm: null,
        }));

      return NextResponse.json({ houseTypes });
    }

    // No unit types found
    return NextResponse.json({ houseTypes: [] });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch house types' },
      { status: 500 }
    );
  }
}
