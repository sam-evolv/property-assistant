import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

const KNOWN_DEVELOPMENTS: Record<string, { id: string; name: string; address: string }> = {
  '57dc3919-2725-4575-8046-9179075ac88e': {
    id: '57dc3919-2725-4575-8046-9179075ac88e',
    name: 'Longview Park',
    address: 'Longview Park, Cork',
  },
  '6d37c4a8-5319-4d7f-9cd2-4f1a8bc25e91': {
    id: '6d37c4a8-5319-4d7f-9cd2-4f1a8bc25e91', 
    name: 'Rathard Park',
    address: 'Rathard Park, Cork',
  },
};

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function inferHouseTypeFromAddress(address: string): string {
  const unitMatch = address.match(/^(\d+)/);
  const unitNum = unitMatch ? parseInt(unitMatch[1], 10) : 0;
  
  if (unitNum >= 1 && unitNum <= 40) return 'BD01';
  if (unitNum >= 41 && unitNum <= 80) return 'BD02';
  if (unitNum >= 81 && unitNum <= 100) return 'BD03';
  return 'BD01';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID is required' }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isDirectUnitId = uuidRegex.test(token) && token === unitUid;
    
    if (!isDirectUnitId) {
      const payload = await validateQRToken(token);
      if (!payload || payload.supabaseUnitId !== unitUid) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
      }
    }

    console.log('[Profile] Fetching unit from Supabase:', unitUid);
    
    const supabase = getSupabaseClient();
    const { data: supabaseUnit, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, project_id, unit_type_id')
      .eq('id', unitUid)
      .single();
    
    if (error || !supabaseUnit) {
      console.error('[Profile] Unit not found:', error?.message);
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    console.log('[Profile] Found unit:', supabaseUnit.id, 'Address:', supabaseUnit.address);

    const development = KNOWN_DEVELOPMENTS[supabaseUnit.project_id] || {
      id: supabaseUnit.project_id,
      name: 'Development',
      address: '',
    };

    let houseTypeCode = 'BD01';
    let houseTypeName = 'Semi-Detached';
    let bedrooms = 3;
    let bathrooms = 2;
    
    if (supabaseUnit.unit_type_id) {
      const { data: unitType } = await supabase
        .from('unit_types')
        .select('name, bedrooms, bathrooms, floor_area_sqm')
        .eq('id', supabaseUnit.unit_type_id)
        .single();
      
      if (unitType) {
        houseTypeName = unitType.name || houseTypeName;
        if (unitType.name?.match(/BD\d+/)) {
          houseTypeCode = unitType.name.match(/BD\d+/)![0];
        }
        if (unitType.bedrooms) bedrooms = unitType.bedrooms;
        if (unitType.bathrooms) bathrooms = unitType.bathrooms;
      }
    } else if (supabaseUnit.address) {
      houseTypeCode = inferHouseTypeFromAddress(supabaseUnit.address);
    }

    const purchaserName = supabaseUnit.purchaser_name || 'Homeowner';
    const fullAddress = supabaseUnit.address || development.address || 'Address not available';

    console.log('[Profile] Built profile for:', purchaserName, 'HouseType:', houseTypeCode);

    const profile = {
      unit: {
        id: supabaseUnit.id,
        unit_uid: supabaseUnit.id,
        address: fullAddress,
        eircode: null,
        house_type_code: houseTypeCode,
        house_type_name: houseTypeName,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        floor_area_sqm: null,
      },
      development: {
        id: development.id,
        name: development.name,
        address: development.address,
      },
      purchaser: {
        name: purchaserName,
      },
      intel: null,
      specifications: null,
      documents: [],
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Purchaser Profile Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
