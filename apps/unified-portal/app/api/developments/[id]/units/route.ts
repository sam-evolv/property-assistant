import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/developments/:id/units
// Returns all units for a development with handover status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = params;

    // Fetch units for this development
    const { data: units, error } = await supabase
      .from('units')
      .select(`
        id,
        unit_uid,
        unit_code,
        address,
        purchaser_name,
        house_type,
        bedrooms,
        handover_complete,
        current_milestone,
        milestone_dates,
        est_snagging_date,
        est_handover_date
      `)
      .eq('development_id', id)
      .order('unit_code', { ascending: true });

    if (error) {
      console.error('Error fetching units:', error);
      return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
    }

    // Map to consistent format
    const mappedUnits = (units || []).map((unit: any) => ({
      id: unit.id,
      unit_uid: unit.unit_uid,
      unit_code: unit.unit_code,
      address: unit.address || `Unit ${unit.unit_code || unit.unit_uid}`,
      purchaser_name: unit.purchaser_name,
      house_type: unit.house_type,
      bedrooms: unit.bedrooms,
      handover_complete: unit.handover_complete || false,
      current_milestone: unit.current_milestone || 'sale_agreed',
      milestone_dates: unit.milestone_dates || {},
      est_snagging_date: unit.est_snagging_date,
      est_handover_date: unit.est_handover_date,
    }));

    return NextResponse.json({ units: mappedUnits });
  } catch (error) {
    console.error('Error in GET units:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
