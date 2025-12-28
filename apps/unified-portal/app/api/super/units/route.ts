import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const requestId = `units-${Date.now()}`;
  
  try {
    await requireRole(['super_admin', 'admin']);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log(`[API:${requestId}] /api/super/units - projectId:`, projectId || 'all');
    
    const supabase = getSupabaseClient();
    
    // Build query for units with project info
    let query = supabase
      .from('units')
      .select(`
        id,
        address,
        purchaser_name,
        handover_date,
        snag_list_url,
        created_at,
        project_id,
        unit_type_id,
        projects!inner(id, name, address)
      `)
      .order('created_at', { ascending: false });
    
    // Filter by project if specified
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data: unitsData, error: unitsError } = await query;
    
    if (unitsError) {
      console.error(`[API:${requestId}] Supabase error:`, unitsError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch units from database',
          requestId,
          details: unitsError.message
        },
        { status: 500 }
      );
    }

    // Get unit types for additional info
    const { data: unitTypes } = await supabase
      .from('unit_types')
      .select('id, name');
    
    const unitTypeMap = new Map((unitTypes || []).map(ut => [ut.id, ut.name]));

    const formattedUnits = (unitsData || []).map((unit: any) => ({
      id: unit.id,
      unit_number: unit.address,
      address: unit.address,
      unit_type_name: unit.unit_type_id ? unitTypeMap.get(unit.unit_type_id) || 'Unknown' : 'Unknown',
      house_type_code: unit.unit_type_id ? unitTypeMap.get(unit.unit_type_id) || 'Unknown' : 'Unknown',
      project_name: unit.projects?.name || 'Unknown',
      project_address: unit.projects?.address || '',
      purchaser_name: unit.purchaser_name || null,
      purchaser_email: null,
      user_id: null,
      bedrooms: null,
      handover_date: unit.handover_date || null,
      has_snag_list: !!unit.snag_list_url,
      created_at: unit.created_at,
    }));

    // Sort by address naturally
    formattedUnits.sort((a: any, b: any) => {
      const aMatch = a.address.match(/^(\d+)/);
      const bMatch = b.address.match(/^(\d+)/);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
      return a.address.localeCompare(b.address);
    });

    console.log(`[API:${requestId}] /api/super/units - returned:`, formattedUnits.length, 'units');

    return NextResponse.json({ 
      units: formattedUnits,
      count: formattedUnits.length,
      projectId: projectId || null,
      requestId,
    });
  } catch (error: any) {
    console.error(`[API:${requestId}] /api/super/units error:`, error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch units',
        requestId,
      },
      { status: 500 }
    );
  }
}
