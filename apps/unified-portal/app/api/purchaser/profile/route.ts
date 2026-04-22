import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { globalCache } from '@/lib/cache/ttl-cache';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

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

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
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

    // Source of truth: the units row. We intentionally do NOT read unit_types.specification_json
    // — that is a type-level default, and for Rathárd Park it contains known-wrong values
    // (4/3 bed/bath instead of 2/2, floor area in sqft under an sqm key).
    const { data: supabaseUnit, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, project_id, development_id, house_type_code, bedrooms, bathrooms, floor_area_m2, property_type')
      .eq('id', unitUid)
      .single();

    if (error || !supabaseUnit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // DEVELOPMENT NAME: resolve via developments table using unit.development_id.
    // Never use projects.name — a UUID collision between projects and developments
    // causes "Árdan View" to leak into Rathárd Park homes.
    let developmentName: string | null = null;
    let developmentUuid: string | null = (supabaseUnit as any).development_id || null;
    let projectsNameDiag: string | null = null;

    if (developmentUuid) {
      try {
        const { rows } = await db.execute(sql`
          SELECT id, name, address FROM developments WHERE id = ${developmentUuid}::uuid LIMIT 1
        `);
        if (rows.length > 0) {
          const dev = rows[0] as any;
          developmentName = dev.name || null;
        }
      } catch (_devErr) {
        // Leave null — UI will render "—"
      }
    }

    // Fetch projects.name purely for diagnostic logging, never for display.
    if (supabaseUnit.project_id) {
      try {
        const { data: project } = await supabase
          .from('projects')
          .select('name, address')
          .eq('id', supabaseUnit.project_id)
          .single();
        projectsNameDiag = project?.name || null;
      } catch (_projErr) {
        // ignore
      }
    }

    // Server-side diagnostic log (task brief Part B.3)
    console.log('[profile] unit loaded', JSON.stringify({
      unit_id: supabaseUnit.id,
      project_id: supabaseUnit.project_id,
      development_id: developmentUuid,
      developments_name: developmentName,
      projects_name: projectsNameDiag,
    }));

    const devAddress: string | null = null; // projects.address is not used for display
    const developmentAddress = developmentName
      ? formatSchemeAddress(developmentName, devAddress)
      : '';

    const development = {
      id: developmentUuid || supabaseUnit.project_id,
      name: developmentName || '',
      address: developmentAddress,
    };

    const houseTypeCode = ((supabaseUnit as any).house_type_code as string | null) || '';
    const houseTypeName = ((supabaseUnit as any).property_type as string | null) || houseTypeCode;
    const bedrooms = toNumberOrNull((supabaseUnit as any).bedrooms);
    const bathrooms = toNumberOrNull((supabaseUnit as any).bathrooms);
    const floorAreaM2 = toNumberOrNull((supabaseUnit as any).floor_area_m2);
    
    const purchaserName = supabaseUnit.purchaser_name || 'Homeowner';
    
    const unitNumber = supabaseUnit.address || '';
    const isJustNumber = /^\d+[a-zA-Z]?$/.test(unitNumber.trim());
    const fullAddress = isJustNumber && developmentAddress
      ? `Unit ${unitNumber}, ${developmentAddress}`
      : (supabaseUnit.address || developmentAddress || 'Address not available');
    
    const documents: { id: string; title: string; file_url: string | null; mime_type: string; category: string }[] = [];

    try {
      // Fetch only this homeowner's architectural drawings matching their house type
      const { data: drawingSections } = await supabase
        .from('document_sections')
        .select('id, metadata')
        .eq('project_id', supabaseUnit.project_id)
        .eq('metadata->>discipline', 'architectural')
        .eq('metadata->>house_type_code', houseTypeCode);

      const uniqueDocs = new Map<string, { id: string; title: string; file_url: string | null; mime_type: string; category: string }>();

      for (const section of (drawingSections || [])) {
        const meta = section.metadata as Record<string, unknown>;
        if (!meta) continue;
        const source = (meta.source as string | undefined) || 'Unknown';
        const fileUrl = (meta.file_url as string | undefined) || null;
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

      documents.push(...Array.from(uniqueDocs.values()));

    } catch (_docErr) {
      // silent
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
        floor_area_m2: floorAreaM2,
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
