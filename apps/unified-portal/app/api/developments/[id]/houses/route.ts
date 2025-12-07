import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '97dc3919-2726-4675-8046-9f79070ec88c';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Houses API] Frontend asked for:', params.id);
    console.log('[Houses API] Overriding with REAL ID:', REAL_PROJECT_ID);
    
    const session = await requireRole(['developer', 'super_admin']);
    console.log('[Houses API] Session validated');

    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, unit_number, unit_type_id, user_id, created_at')
      .eq('project_id', REAL_PROJECT_ID);

    if (unitsError) {
      console.error('[Houses API] Supabase error:', unitsError);
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }

    console.log('[Houses API] Found units from Supabase:', units?.length || 0);

    const houses = (units || []).map((unit, idx) => ({
      id: unit.id,
      development_id: REAL_PROJECT_ID,
      unit_number: unit.unit_number || `Unit ${idx + 1}`,
      unit_uid: unit.id,
      address_line_1: unit.unit_number || `Unit ${idx + 1}`,
      address_line_2: null,
      city: null,
      state_province: null,
      postal_code: null,
      country: null,
      house_type_code: unit.unit_type_id || null,
      bedrooms: null,
      bathrooms: null,
      square_footage: null,
      purchaser_name: null,
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
    console.error('[Houses API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch houses' },
      { status: 500 }
    );
  }
}
