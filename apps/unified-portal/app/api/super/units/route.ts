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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const developmentId = searchParams.get('development_id') || searchParams.get('projectId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('units')
      .select('*', { count: 'exact' })
      .order('address_line_1', { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`unit_number.ilike.%${search}%,address_line_1.ilike.%${search}%,unit_code.ilike.%${search}%`);
    }

    if (developmentId) {
      query = query.or(`development_id.eq.${developmentId},project_id.eq.${developmentId}`);
    }

    const { data: unitsData, error: unitsError, count } = await query;

    if (unitsError) {
      console.error('[Units API] Query error:', unitsError);
      return NextResponse.json({ error: unitsError.message }, { status: 500 });
    }

    const { data: projectsData } = await supabaseAdmin
      .from('projects')
      .select('id, name');
    
    const { data: developmentsData } = await supabaseAdmin
      .from('developments')
      .select('id, name');

    const projectsMap = new Map((projectsData || []).map(p => [p.id, p.name]));
    const developmentsMap = new Map((developmentsData || []).map(d => [d.id, d.name]));

    const allDevelopments = [
      ...(projectsData || []).map(p => ({ id: p.id, name: p.name })),
      ...(developmentsData || []).map(d => ({ id: d.id, name: d.name })),
    ];

    const formattedUnits = (unitsData || []).map((u: any) => ({
      id: u.id,
      unit_uid: u.unit_uid,
      unit_number: u.unit_number || u.lot_number,
      unit_code: u.unit_code,
      address: [u.address_line_1, u.address_line_2, u.city, u.eircode].filter(Boolean).join(', ') || u.address,
      address_line_1: u.address_line_1 || u.address,
      purchaser: u.purchaser_name ? {
        name: u.purchaser_name,
        email: u.purchaser_email || u.owner_email,
        phone: u.purchaser_phone,
      } : null,
      purchaser_name: u.purchaser_name || u.owner_name,
      purchaser_email: u.purchaser_email || u.owner_email,
      propertyType: u.property_type || u.house_type_code || u.house_type,
      house_type_code: u.house_type_code || u.house_type,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      development: {
        id: u.development_id || u.project_id,
        name: developmentsMap.get(u.development_id) || projectsMap.get(u.project_id) || 'Unknown',
      },
      project_name: developmentsMap.get(u.development_id) || projectsMap.get(u.project_id) || 'Unknown',
      status: u.consent_at ? 'handed_over' : u.purchaser_name ? 'assigned' : 'available',
      timeline: {
        created: u.created_at,
        handedOver: u.consent_at,
        lastActivity: u.last_chat_at,
      },
      created_at: u.created_at,
    }));

    const totalCount = count || 0;
    const withPurchaser = (unitsData || []).filter((u: any) => u.purchaser_name).length;
    const handedOver = (unitsData || []).filter((u: any) => u.consent_at).length;

    return NextResponse.json({
      units: formattedUnits,
      count: formattedUnits.length,
      developments: allDevelopments,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        total: totalCount,
        withPurchaser,
        handedOver,
        pending: totalCount - handedOver,
      },
    });
  } catch (error: any) {
    console.error('[API] /api/super/units error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch units' },
      { status: 500 }
    );
  }
}
