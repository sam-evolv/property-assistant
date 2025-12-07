import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for real unit data
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Houses API] Fetching houses for project:', params.id);
    const session = await requireRole(['developer', 'super_admin']);
    console.log('[Houses API] Session validated');
    const projectId = params.id;

    // Fetch units from Supabase with unit_types
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('*, unit_types(*)')
      .eq('project_id', projectId)
      .order('unit_number');

    if (unitsError) {
      console.error('[Houses API] Error fetching units from Supabase:', unitsError);
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }

    console.log('[Houses API] Found units from Supabase:', units?.length || 0);

    // Transform Supabase units to match expected House interface
    const houses = (units || []).map(unit => ({
      id: unit.id,
      development_id: unit.project_id,
      unit_number: unit.unit_number,
      unit_uid: unit.id,
      address_line_1: `Unit ${unit.unit_number}`,
      address_line_2: null,
      city: null,
      state_province: null,
      postal_code: null,
      country: null,
      house_type_code: unit.unit_types?.type_name || null,
      bedrooms: unit.unit_types?.bedrooms || null,
      bathrooms: unit.unit_types?.bathrooms || null,
      square_footage: unit.unit_types?.total_area_sqm ? Math.round(unit.unit_types.total_area_sqm * 10.764) : null,
      purchaser_name: null, // Will be fetched from auth if needed
      purchaser_email: null,
      purchaser_phone: null,
      purchase_date: null,
      move_in_date: null,
      created_at: unit.created_at,
      updated_at: null,
      user_id: unit.user_id,
    }));

    return NextResponse.json({ houses });
  } catch (error) {
    console.error('[Development Houses Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch houses' },
      { status: 500 }
    );
  }
}
