import { NextRequest, NextResponse } from 'next/server';
import { signQRToken } from '@openhouse/api/qr-tokens';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Please enter your OpenHouse code' },
        { status: 400 }
      );
    }

    const trimmedCode = code.trim().toUpperCase();
    
    if (trimmedCode.length < 3) {
      return NextResponse.json(
        { error: 'Code is too short' },
        { status: 400 }
      );
    }

    console.log('[Purchaser Auth] Validating code:', trimmedCode);

    const supabase = getSupabaseAdmin();
    let unit: any = null;
    let project: any = null;

    // CRITICAL: First try exact match on unit_uid (the QR code)
    // This ensures RA-LAWN-001 only matches Rathard Lawn, LV-PARK-001 only matches Longview Park
    const { data: exactUnitMatch, error: exactMatchError } = await supabase
      .from('units')
      .select('id, project_id, address, purchaser_name, unit_uid, house_type_code, bedrooms, bathrooms')
      .eq('unit_uid', trimmedCode)
      .single();

    if (exactMatchError && exactMatchError.code !== 'PGRST116') {
      console.error('[Purchaser Auth] Supabase error during unit_uid lookup:', exactMatchError);
    }

    if (exactUnitMatch) {
      console.log('[Purchaser Auth] Found exact unit_uid match:', exactUnitMatch.id, 'unit_uid:', exactUnitMatch.unit_uid);
      
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name, developer_id')
        .eq('id', exactUnitMatch.project_id)
        .single();
      
      if (projectError) {
        console.error('[Purchaser Auth] Project lookup error:', projectError.message);
      }
      console.log('[Purchaser Auth] Project data:', projectData);
      
      project = projectData;
      unit = {
        id: exactUnitMatch.id,
        development_id: exactUnitMatch.project_id,
        address: exactUnitMatch.address,
        purchaser_name: exactUnitMatch.purchaser_name,
        tenant_id: projectData?.developer_id || exactUnitMatch.project_id,
        development_name: projectData?.name || 'Your Development',
        house_type_code: exactUnitMatch.house_type_code,
        bedrooms: exactUnitMatch.bedrooms,
        bathrooms: exactUnitMatch.bathrooms,
      };
    }

    if (!unit) {
      console.log('[Purchaser Auth] Code not found:', trimmedCode);
      return NextResponse.json(
        { error: 'Invalid code. Please check and try again.' },
        { status: 404 }
      );
    }

    console.log('[Purchaser Auth] Valid code for unit:', unit.id, 'Development:', unit.development_name);

    const tokenResult = signQRToken({
      supabaseUnitId: unit.id,
      projectId: unit.development_id,
    });

    const sessionData = {
      unitId: unit.id,
      unitUid: trimmedCode,
      developmentId: unit.development_id,
      developmentName: unit.development_name,
      developmentLogoUrl: null,
      purchaserName: unit.purchaser_name || 'Homeowner',
      address: unit.address || '',
      houseType: unit.house_type_code || '',
      bedrooms: unit.bedrooms || null,
      bathrooms: unit.bathrooms || null,
      latitude: null,
      longitude: null,
      token: tokenResult.token,
    };

    return NextResponse.json({
      success: true,
      session: sessionData,
    });
  } catch (error: any) {
    console.error('[Purchaser Auth] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
