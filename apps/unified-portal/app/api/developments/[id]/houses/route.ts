import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const developmentId = params.id;

    if (!developmentId) {
      return NextResponse.json({ error: 'Development ID required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const session = await requireRole(['developer', 'super_admin']);

    console.log('[Houses] Fetching units for development:', developmentId, 'tenant:', session.tenantId);

    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select(
        'id, development_id, tenant_id, unit_number, unit_uid, address_line_1, address_line_2, ' +
        'city, country, eircode, house_type_code, bedrooms, bathrooms, ' +
        'purchaser_name, unit_status, unit_mode, created_at'
      )
      .eq('development_id', developmentId)
      .order('unit_number', { ascending: true })
      .limit(1000);

    if (error) {
      console.error('[Houses] Error fetching units:', error);
      return NextResponse.json({ error: 'Failed to fetch houses' }, { status: 500 });
    }

    console.log('[Houses] Found:', units?.length || 0, 'units for development:', developmentId);

    const houses = (units || []).map((unit: any) => ({
      id: unit.id,
      development_id: unit.development_id,
      unit_number: unit.unit_number || '',
      unit_uid: unit.unit_uid || unit.id,
      address_line_1: unit.address_line_1 || null,
      address_line_2: unit.address_line_2 || null,
      city: unit.city || null,
      state_province: null,
      postal_code: unit.eircode || null,
      country: unit.country || null,
      house_type_code: unit.house_type_code || null,
      bedrooms: unit.bedrooms || null,
      bathrooms: unit.bathrooms || null,
      square_footage: null,
      purchaser_name: unit.purchaser_name || null,
      purchaser_email: null,
      purchaser_phone: null,
      purchase_date: null,
      move_in_date: null,
      unit_status: unit.unit_status || null,
      created_at: unit.created_at,
      updated_at: null,
    }));

    return NextResponse.json({ houses });
  } catch (error) {
    console.error('[Houses] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to fetch houses' }, { status: 500 });
  }
}
