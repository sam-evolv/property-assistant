import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();
    
    if (normalizedCode.length < 3) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: unit, error } = await supabase
      .from('units')
      .select(`
        id,
        unit_uid,
        unit_number,
        address_line_1,
        house_type_code,
        bedrooms,
        bathrooms,
        development_id,
        developments!units_development_id_fkey (
          id,
          name,
          code
        )
      `)
      .eq('unit_uid', normalizedCode)
      .single();

    if (error || !unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const development = unit.developments as any;

    return NextResponse.json({
      success: true,
      unit: {
        id: unit.id,
        accessCode: unit.unit_uid,
        unitNumber: unit.unit_number,
        address: unit.address_line_1,
        houseTypeCode: unit.house_type_code,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        developmentId: unit.development_id,
        developmentName: development?.name || null,
        developmentCode: development?.code || null,
      },
    });
  } catch (error: any) {
    console.error('[Unit Lookup] Error:', error);
    return NextResponse.json(
      { error: 'Lookup failed' },
      { status: 500 }
    );
  }
}
