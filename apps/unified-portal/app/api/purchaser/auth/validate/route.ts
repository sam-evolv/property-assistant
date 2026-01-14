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

    // Parse QR code format: PREFIX-N where PREFIX identifies the project and N is 1-3 digits
    // LV-PARK-XXX = Longview Park, RA-PARK-XXX = Rathard Park, RA-LAWN-XXX = Rathard Lawn
    const codeMatch = trimmedCode.match(/^([A-Z]+-[A-Z]+)-(\d{1,3})$/);
    
    if (!codeMatch) {
      console.log('[Purchaser Auth] Invalid code format:', trimmedCode);
      return NextResponse.json(
        { error: 'Invalid code format. Please check and try again.' },
        { status: 400 }
      );
    }
    
    const [, prefix, unitNumStr] = codeMatch;
    const unitNum = parseInt(unitNumStr, 10);
    
    // Map prefix to project name
    const prefixToProjectName: Record<string, string> = {
      'LV-PARK': 'Longview Park',
      'RA-PARK': 'Rathard Park',
      'RA-LAWN': 'Rathard Lawn',
    };
    
    const expectedProjectName = prefixToProjectName[prefix];
    if (!expectedProjectName) {
      console.log('[Purchaser Auth] Unknown project prefix:', prefix);
      return NextResponse.json(
        { error: 'Invalid code. Please check and try again.' },
        { status: 400 }
      );
    }
    
    // Find the project by name
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .ilike('name', expectedProjectName)
      .single();
    
    if (projectError || !projectData) {
      console.log('[Purchaser Auth] Project not found for:', expectedProjectName);
      return NextResponse.json(
        { error: 'Development not found. Please check your code.' },
        { status: 404 }
      );
    }
    
    console.log('[Purchaser Auth] Found project:', projectData.id, projectData.name, 'for prefix:', prefix);
    
    // Find the unit by address number within this specific project
    const { data: projectUnits, error: unitsError } = await supabase
      .from('units')
      .select('id, project_id, address, purchaser_name')
      .eq('project_id', projectData.id);
    
    if (unitsError) {
      console.error('[Purchaser Auth] Error fetching units:', unitsError);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }
    
    // Find unit matching the address number
    // Handle both formats: "1 Longview Park..." and just "1" or "10"
    const matchedUnit = projectUnits?.find((u: any) => {
      const addr = u.address?.trim();
      if (!addr) return false;
      
      // Match addresses that are just a number (e.g., "1", "10")
      if (/^\d+$/.test(addr)) {
        return parseInt(addr, 10) === unitNum;
      }
      
      // Match addresses starting with a number followed by space (e.g., "1 Longview Park")
      const addrMatch = addr.match(/^(\d+)\s/);
      return addrMatch && parseInt(addrMatch[1], 10) === unitNum;
    });
    
    if (matchedUnit) {
      console.log('[Purchaser Auth] Found unit:', matchedUnit.id, 'in project:', projectData.name);
      
      project = projectData;
      unit = {
        id: matchedUnit.id,
        development_id: matchedUnit.project_id,
        address: matchedUnit.address,
        purchaser_name: matchedUnit.purchaser_name,
        tenant_id: projectData.id,
        development_name: projectData.name,
        house_type_code: null,
        bedrooms: null,
        bathrooms: null,
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
