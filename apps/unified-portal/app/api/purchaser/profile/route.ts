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

function parseNumericValue(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
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

    console.log('[Profile] Found unit:', supabaseUnit.id, 'Address:', supabaseUnit.address, 'unit_type_id:', supabaseUnit.unit_type_id);

    const development = KNOWN_DEVELOPMENTS[supabaseUnit.project_id] || {
      id: supabaseUnit.project_id,
      name: 'Development',
      address: '',
    };

    let houseTypeCode = 'BD01';
    let houseTypeName = 'Semi-Detached';
    let bedrooms: number | null = 3;
    let bathrooms: number | null = 2;
    let floorAreaSqm: number | null = null;
    
    if (supabaseUnit.unit_type_id) {
      const { data: unitType } = await supabase
        .from('unit_types')
        .select('name, specification_json')
        .eq('id', supabaseUnit.unit_type_id)
        .single();
      
      if (unitType) {
        houseTypeCode = unitType.name || houseTypeCode;
        houseTypeName = unitType.name || houseTypeName;
        
        const specs = unitType.specification_json as any;
        if (specs) {
          bedrooms = parseNumericValue(specs.bedrooms) ?? bedrooms;
          bathrooms = parseNumericValue(specs.bathrooms) ?? bathrooms;
          if (specs.property_type) {
            houseTypeName = specs.property_type;
          }
        }
      }
    }

    const purchaserName = supabaseUnit.purchaser_name || 'Homeowner';
    const fullAddress = supabaseUnit.address || development.address || 'Address not available';

    const documents: any[] = [];
    try {
      const { data: docSections } = await supabase
        .from('document_sections')
        .select('id, metadata')
        .eq('project_id', supabaseUnit.project_id);

      if (docSections && docSections.length > 0) {
        const uniqueDocs = new Map<string, any>();
        
        for (const section of docSections) {
          const meta = section.metadata as any;
          if (!meta) continue;
          
          const fileName = meta.file_name || meta.source || 'Unknown';
          const fileUrl = meta.file_url || null;
          
          const fileNameLower = fileName.toLowerCase();
          const houseCodeLower = houseTypeCode.toLowerCase();
          const isHouseTypeDoc = fileNameLower.includes(houseCodeLower) || 
                                 fileNameLower.includes('floor') ||
                                 fileNameLower.includes('plan') ||
                                 fileNameLower.includes('elevation') ||
                                 fileNameLower.includes('layout');
          
          const isImportant = meta.is_important === true || meta.must_read === true;
          
          if ((isHouseTypeDoc || isImportant) && !uniqueDocs.has(fileName)) {
            uniqueDocs.set(fileName, {
              id: section.id,
              title: fileName.replace('.pdf', '').replace(/-/g, ' '),
              file_url: fileUrl,
              mime_type: 'application/pdf',
              category: getDocCategory(fileName),
            });
          }
        }
        
        documents.push(...Array.from(uniqueDocs.values()).slice(0, 10));
      }
      
      console.log('[Profile] Found', documents.length, 'documents for house type:', houseTypeCode);
    } catch (docErr) {
      console.error('[Profile] Error fetching documents:', docErr);
    }

    console.log('[Profile] Built profile for:', purchaserName, 'HouseType:', houseTypeCode, 'Beds:', bedrooms, 'Baths:', bathrooms);

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
        floor_area_sqm: floorAreaSqm,
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
      documents: documents,
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Purchaser Profile Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

function getDocCategory(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('floor') || lower.includes('plan') || lower.includes('layout')) return 'Floor Plans';
  if (lower.includes('elevation')) return 'Elevations';
  if (lower.includes('spec')) return 'Specifications';
  if (lower.includes('user') || lower.includes('guide')) return 'User Guides';
  return 'Documents';
}
