import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { globalCache } from '@/lib/cache/ttl-cache';

export const dynamic = 'force-dynamic';

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || '127.0.0.1';
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatSchemeAddress(projectName: string, projectAddress: string | null): string {
  if (projectAddress) {
    return `${projectName}, ${projectAddress}`;
  }
  return projectName;
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'x-request-id': `profile-${Date.now()}`
        }
      }
    }
  );
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  const rateCheck = checkRateLimit(clientIP, '/api/purchaser/profile');
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfterMs: rateCheck.resetMs },
      { status: 429, headers: { 'x-request-id': requestId, 'retry-after': String(Math.ceil(rateCheck.resetMs / 1000)) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID is required' }, { status: 400, headers: { 'x-request-id': requestId } });
    }

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401, headers: { 'x-request-id': requestId } });
    }

    const cacheKey = `profile:${unitUid}`;
    // Cache disabled — every request goes fresh to avoid stale responses after deploys

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: { 'x-request-id': requestId } });
    }

    const supabase = getSupabaseClient();
    // Select house_type_code directly — it is a first-class column on units.
    const { data: supabaseUnit, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, project_id, unit_type_id, house_type_code')
      .eq('id', unitUid)
      .single();
    
    if (error || !supabaseUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('name, address')
      .eq('id', supabaseUnit.project_id)
      .single();
    
    const developmentName = project?.name || 'Unknown Development';
    const developmentAddress = formatSchemeAddress(developmentName, project?.address || null);
    
    const development = {
      id: supabaseUnit.project_id,
      name: developmentName,
      address: developmentAddress,
    };

    // Prefer the direct house_type_code column; fall back to unit_types.name for display name only
    let houseTypeCode = (supabaseUnit.house_type_code as string | null) || '';
    console.log(`[profile] houseTypeCode="${houseTypeCode}" unitId="${unitUid}"`);
    let houseTypeName = houseTypeCode;
    let bedrooms: number | null = null;
    let bathrooms: number | null = null;
    let floorAreaSqm: number | null = null;

    if (supabaseUnit.unit_type_id) {
      const { data: unitType } = await supabase
        .from('unit_types')
        .select('name, specification_json')
        .eq('id', supabaseUnit.unit_type_id)
        .single();

      if (unitType) {
        // Use direct column as authoritative code; unit_types.name gives us a display name
        if (!houseTypeCode) houseTypeCode = unitType.name || '';
        houseTypeName = unitType.name || houseTypeCode;

        const specs = unitType.specification_json as Record<string, unknown>;
        if (specs) {
          bedrooms = parseNumericValue(specs.bedrooms);
          bathrooms = parseNumericValue(specs.bathrooms);
          floorAreaSqm = parseNumericValue(specs.floor_area_sqm) || parseNumericValue(specs.floor_area);
          if (specs.property_type) {
            houseTypeName = specs.property_type as string;
          }
        }
      }
    }
    
    const purchaserName = supabaseUnit.purchaser_name || 'Homeowner';
    
    const unitNumber = supabaseUnit.address || '';
    const isJustNumber = /^\d+[a-zA-Z]?$/.test(unitNumber.trim());
    const fullAddress = isJustNumber && developmentAddress
      ? `Unit ${unitNumber}, ${developmentAddress}`
      : (supabaseUnit.address || developmentAddress || 'Address not available');
    
    const documents: { id: string; title: string; file_url: string | null; mime_type: string; category: string }[] = [];
    try {
      const { data: docSections } = await supabase
        .from('document_sections')
        .select('id, metadata')
        .eq('project_id', supabaseUnit.project_id);

      if (docSections && docSections.length > 0) {
        const uniqueDocs = new Map<string, { id: string; title: string; file_url: string | null; mime_type: string; category: string }>();
        const unitHouseCodeLower = houseTypeCode.toLowerCase();

        for (const section of docSections) {
          const meta = section.metadata as Record<string, unknown>;
          if (!meta) continue;

          const source = (meta.source as string | undefined) || (meta.file_name as string | undefined) || 'Unknown';
          const fileUrl = (meta.file_url as string | undefined) || null;
          const sectionDiscipline = ((meta.discipline as string | undefined) || '').toLowerCase();

          // Drawings: architectural discipline OR source referencing a drawing set
          const isDrawing = sectionDiscipline === 'architectural' ||
                            source.toLowerCase().includes('281-mhl');

          if (isDrawing && unitHouseCodeLower) {
            // Drawing must match the homeowner's house_type_code exactly — fail closed
            const docHouseCodeLower = ((meta.house_type_code as string | undefined) || '').toLowerCase().trim();
            if (!docHouseCodeLower || docHouseCodeLower !== unitHouseCodeLower) {
              continue;
            }
          }
          // Non-drawings: include without house type restriction

          if (!uniqueDocs.has(source)) {
            uniqueDocs.set(source, {
              id: section.id,
              title: source.replace('.pdf', '').replace(/-/g, ' ').replace(/_/g, ' '),
              file_url: fileUrl,
              mime_type: 'application/pdf',
              category: getDocCategory(source),
            });
          }
        }

        documents.push(...Array.from(uniqueDocs.values()).slice(0, 50));
      }

    } catch (_docErr) {
        // error handled silently
    }

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

    globalCache.set(cacheKey, profile, 0);
    return NextResponse.json(profile, { headers: { 'x-request-id': requestId, 'x-cache': 'MISS' } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500, headers: { 'x-request-id': requestId } });
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
