import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Houses API] Fetching houses for project:', REAL_PROJECT_ID);
    
    const session = await requireRole(['developer', 'super_admin']);

    // Query units with unit_types from Supabase
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select(`
        id,
        address,
        purchaser_name,
        unit_number,
        project_id,
        created_at,
        unit_types (
          name,
          bedrooms,
          bathrooms
        )
      `)
      .eq('project_id', REAL_PROJECT_ID)
      .order('unit_number', { ascending: true });

    if (unitsError) {
      console.error('[Houses API] Supabase error:', unitsError);
      throw unitsError;
    }

    console.log('[Houses API] Found units:', units?.length || 0);

    const houses = (units || []).map((unit: any) => ({
      id: unit.id,
      development_id: unit.project_id || REAL_PROJECT_ID,
      unit_number: unit.unit_number ? `Unit ${unit.unit_number}` : unit.id.substring(0, 8),
      unit_uid: unit.id,
      address_line_1: unit.address || `Unit ${unit.unit_number || ''}`,
      address_line_2: null,
      city: null,
      state_province: null,
      postal_code: null,
      country: null,
      house_type_code: unit.unit_types?.name || null,
      bedrooms: unit.unit_types?.bedrooms || null,
      bathrooms: unit.unit_types?.bathrooms || null,
      square_footage: null,
      purchaser_name: unit.purchaser_name || null,
      purchaser_email: null,
      purchaser_phone: null,
      purchase_date: null,
      move_in_date: null,
      created_at: unit.created_at,
      updated_at: null,
      user_id: null,
    }));

    return NextResponse.json({ houses });
  } catch (error) {
    console.error('[Houses API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch houses' },
      { status: 500 }
    );
  }
}
