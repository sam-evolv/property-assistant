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

    const numMatch = trimmedCode.match(/(\d+)/);
    const unitNum = numMatch ? parseInt(numMatch[1], 10) : null;

    if (!unitNum) {
      console.log('[Purchaser Auth] No unit number found in code:', trimmedCode);
      return NextResponse.json(
        { error: 'Invalid code format. Please check and try again.' },
        { status: 400 }
      );
    }

    const { data: allUnits, error: unitError } = await supabase
      .from('units')
      .select('id, project_id, address, purchaser_name');
    
    if (unitError) {
      console.error('[Purchaser Auth] Supabase error:', unitError);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }

    if (allUnits && allUnits.length > 0) {
      const exactMatch = allUnits.find((u: any) => {
        const addrMatch = u.address?.match(/^(\d+)\s/);
        return addrMatch && parseInt(addrMatch[1], 10) === unitNum;
      });
      
      if (exactMatch) {
        console.log('[Purchaser Auth] Found unit:', exactMatch.id, 'with project_id:', exactMatch.project_id);
        
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('id, name, developer_id')
          .eq('id', exactMatch.project_id)
          .single();
        
        if (projectError) {
          console.error('[Purchaser Auth] Project lookup error:', projectError.message);
        }
        console.log('[Purchaser Auth] Project data:', projectData);
        
        project = projectData;
        unit = {
          id: exactMatch.id,
          development_id: exactMatch.project_id,
          address: exactMatch.address,
          purchaser_name: exactMatch.purchaser_name,
          tenant_id: projectData?.developer_id || exactMatch.project_id,
          development_name: projectData?.name || 'Your Development',
        };
      }
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
      houseType: '',
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
