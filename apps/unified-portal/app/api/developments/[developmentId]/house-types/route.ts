import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
    const { developmentId } = await params;

    if (!developmentId) {
      return NextResponse.json({ error: 'Development ID required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get unique house types from units table for this development
    // This is where the actual house type data lives
    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('house_type_code')
      .eq('project_id', developmentId)
      .not('house_type_code', 'is', null);

    if (error) {
      console.error('[HouseTypes API] Error fetching units:', error);
      return NextResponse.json({ error: 'Failed to fetch house types' }, { status: 500 });
    }

    // Extract unique house type codes
    const uniqueHouseTypes = new Map<string, { id: string; house_type_code: string; development_id: string }>();

    (units || []).forEach((unit: any) => {
      if (unit.house_type_code && !uniqueHouseTypes.has(unit.house_type_code)) {
        // Use the house_type_code as both id and code since we don't have a dedicated house_types table
        uniqueHouseTypes.set(unit.house_type_code, {
          id: unit.house_type_code, // Use code as ID for simplicity
          house_type_code: unit.house_type_code,
          development_id: developmentId,
        });
      }
    });

    const houseTypes = Array.from(uniqueHouseTypes.values()).sort((a, b) =>
      a.house_type_code.localeCompare(b.house_type_code)
    );

    console.log(`[HouseTypes API] Found ${houseTypes.length} house types for development ${developmentId}`);

    return NextResponse.json({ houseTypes });
  } catch (error) {
    console.error('[HouseTypes API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch house types' },
      { status: 500 }
    );
  }
}
