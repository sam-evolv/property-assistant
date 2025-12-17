import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin']);
    const supabaseAdmin = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log('[API] /api/super/homeowners - projectId:', projectId);

    let query = supabaseAdmin
      .from('units')
      .select(`
        id,
        project_id,
        address,
        purchaser_name,
        handover_date,
        created_at,
        user_id,
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
      .order('address', { ascending: true });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: units, error } = await query;

    if (error) {
      console.error('[API] /api/super/homeowners error:', error);
      return NextResponse.json({ error: 'Failed to fetch homeowners' }, { status: 500 });
    }

    const homeowners = (units || []).map((unit: any) => ({
      id: unit.id,
      name: unit.purchaser_name || `Unit ${unit.address || 'Unknown'}`,
      email: 'Not collected',
      house_type: unit.unit_types?.name || null,
      address: unit.address || null,
      development_name: unit.projects?.name || 'Unknown',
      development_id: unit.project_id,
      created_at: unit.created_at,
      chat_message_count: 0,
      last_active: null,
      handover_date: unit.handover_date,
      is_registered: !!unit.user_id,
      has_purchaser: !!unit.purchaser_name,
    }));

    console.log('[API] /api/super/homeowners - returned:', homeowners.length, 'homeowners for projectId:', projectId || 'all');

    return NextResponse.json({ 
      homeowners,
      count: homeowners.length,
      projectId: projectId || null,
    });
  } catch (error: any) {
    console.error('[API] /api/super/homeowners error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch homeowners' },
      { status: 500 }
    );
  }
}
