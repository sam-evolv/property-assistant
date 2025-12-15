import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin']);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required. Use /api/admin/units for all units.' },
        { status: 400 }
      );
    }

    console.log('[API] /api/super/units - projectId:', projectId);

    const query = supabaseAdmin
      .from('units')
      .select(`
        id,
        project_id,
        address,
        unit_type_id,
        user_id,
        handover_date,
        snag_list_url,
        purchaser_name,
        created_at,
        unit_types (
          id,
          name
        ),
        projects (
          id,
          name,
          address
        )
      `)
      .eq('project_id', projectId)
      .order('address', { ascending: true })
      .order('created_at', { ascending: true });

    const { data: units, error } = await query;

    if (error) {
      console.error('[API] /api/super/units error:', error);
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }

    const formattedUnits = (units || []).map((unit: any) => ({
      id: unit.id,
      address: unit.address || '',
      unit_type_name: unit.unit_types?.name || 'Unknown',
      project_name: unit.projects?.name || 'Unknown',
      project_address: unit.projects?.address || '',
      purchaser_name: unit.purchaser_name || null,
      user_id: unit.user_id || null,
      handover_date: unit.handover_date || null,
      has_snag_list: !!unit.snag_list_url,
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
