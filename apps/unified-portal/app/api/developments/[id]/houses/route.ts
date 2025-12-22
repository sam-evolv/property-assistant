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

const REAL_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    console.log('[Houses] Fetching for project:', REAL_PROJECT_ID);
    
    const session = await requireRole(['developer', 'super_admin']);

    // Simple query without join first - limit to 500 houses max
    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('id, address, purchaser_name, project_id, created_at, unit_type_id')
      .eq('project_id', REAL_PROJECT_ID)
      .order('address', { ascending: true })
      .limit(500);

    if (error) {
      console.error('[Houses] Error:', error);
      throw error;
    }

    console.log('[Houses] Found:', units?.length || 0);

    const houses = (units || []).map((unit: any, idx: number) => ({
      id: unit.id,
      development_id: unit.project_id || REAL_PROJECT_ID,
      unit_number: `Unit ${idx + 1}`,
      unit_uid: unit.id,
      address_line_1: unit.address || `Unit ${idx + 1}`,
      house_type_code: unit.unit_type_id || null,
      purchaser_name: unit.purchaser_name || null,
      created_at: unit.created_at,
    }));

    return NextResponse.json({ houses });
  } catch (error) {
    console.error('[Houses] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch houses' }, { status: 500 });
  }
}
