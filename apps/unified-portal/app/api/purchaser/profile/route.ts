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

    // Source of truth: the units row. Historically we avoided reading
    // `unit_types.specification_json` entirely because for Rathárd Park it contains
    // known-wrong values (4/3 bed/bath instead of 2/2, floor area in sqft stored under
    // an sqm key). But for Longview Park (Árdan View / BS01) the units row has NULL
    // bathrooms AND NULL floor_area_m2 across every row, and the type-level
    // specification_json is the only source of per-home dimensions. Bug 3 was caused
    // by only reading the units row, which rendered "—" for both values.
    //
    // Fix: always read the units row first; if bathrooms or floor area are missing,
    // fall back to `unit_types.specification_json` (via `units.unit_type_id`) with
    // these safety rails:
    //   - bathrooms: use the spec value as-is (it's a count)
    //   - floor_area_sqm: treat values > 300 as sqft and divide by 10.7639. Any
    //     realistic residential unit is ≤ 300 m²; Longview's spec value of 1188.33
    //     under a "sqm" key is definitely the sqft (110.4 m²) mislabeled.
    //   - bedrooms: only use the spec value when the units row bedrooms is NULL
    //     (units.bedrooms is trusted when present)
    // We do NOT use unit_types spec for property_type — that's what caused the
    // Rathárd Park bug and is still unreliable.
    const { data: supabaseUnit, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, project_id, development_id, house_type_code, bedrooms, bathrooms, floor_area_m2, property_type, unit_type_id')
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
    let bedrooms = toNumberOrNull((supabaseUnit as any).bedrooms);
    let bathrooms = toNumberOrNull((supabaseUnit as any).bathrooms);
    let floorAreaM2 = toNumberOrNull((supabaseUnit as any).floor_area_m2);

    // Fallback to unit_types.specification_json when the units row is missing
    // bathrooms or floor area. See the note on the units SELECT above for why this
    // is necessary (Longview Park units have NULL for both columns) and the safety
    // rails we apply to spec_json values.
    const unitTypeId = (supabaseUnit as any).unit_type_id as string | null | undefined;
    const needBathrooms = bathrooms === null;
    const needFloorArea = floorAreaM2 === null;
    const needBedrooms = bedrooms === null;
    if (unitTypeId && (needBathrooms || needFloorArea || needBedrooms)) {
      try {
        const { data: unitTypeRow } = await supabase
          .from('unit_types')
          .select('specification_json')
          .eq('id', unitTypeId)
          .single();
        const spec = ((unitTypeRow as any)?.specification_json || {}) as Record<string, unknown>;

        if (needBathrooms) {
          const specBathrooms = toNumberOrNull(spec.bathrooms);
          if (specBathrooms !== null) bathrooms = specBathrooms;
        }

        if (needBedrooms) {
          const specBedrooms = toNumberOrNull(spec.bedrooms);
          if (specBedrooms !== null) bedrooms = specBedrooms;
        }

        if (needFloorArea) {
          // `specification_json.floor_area_sqm` is the documented key, but for
          // Árdan View (BS01) the value is actually the sqft figure mislabeled as
          // sqm (e.g. 1188.33 — which is 110.4 m², the real number). Any value
          // >300 is treated as sqft and converted; anything ≤300 is used as-is.
          const rawArea = toNumberOrNull(spec.floor_area_sqm);
          if (rawArea !== null && rawArea > 0) {
            const SQM_THRESHOLD = 300; // realistic residential ceiling
            const SQFT_TO_SQM = 10.7639;
            const resolved = rawArea > SQM_THRESHOLD ? (rawArea / SQFT_TO_SQM) : rawArea;
            // Round to 1 decimal place — the UI will further round/display as it wishes.
            floorAreaM2 = Math.round(resolved * 10) / 10;
          }
        }

        console.log('[profile] unit-type fallback applied', JSON.stringify({
          unit_id: supabaseUnit.id,
          unit_type_id: unitTypeId,
          needed: { bathrooms: needBathrooms, floorArea: needFloorArea, bedrooms: needBedrooms },
          resolved: { bathrooms, floorAreaM2, bedrooms },
        }));
      } catch (_utErr) {
        // Leave values null — UI will render "—"
      }
    }
    
    const purchaserName = supabaseUnit.purchaser_name || 'Homeowner';
    
    const unitNumber = supabaseUnit.address || '';
    const isJustNumber = /^\d+[a-zA-Z]?$/.test(unitNumber.trim());
    const fullAddress = isJustNumber && developmentAddress
      ? `Unit ${unitNumber}, ${developmentAddress}`
      : (supabaseUnit.address || developmentAddress || 'Address not available');
    
    const documents: {
      id: string;
      title: string;
      file_url: string | null;
      file_name: string;
      mime_type: string;
      category: string;
      drawing_type: string | null;
      drawing_type_label: string | null;
      description: string | null;
    }[] = [];

    try {
      // Source of truth for per-unit drawings is `document_sections`, keyed by
      //   project_id + metadata->drawing_classification->>houseTypeCode.
      // The `documents` table is empty for recently-ingested schemes (e.g.
      // Rathárd Park has 0 rows in documents but 868 rows in document_sections,
      // 5 of which are the BT03 drawings we want to surface).
      if (supabaseUnit.project_id && houseTypeCode) {
        // The house_type_code may be stored in either of two metadata shapes
        // depending on when the document was ingested:
        //   - metadata.drawing_classification.houseTypeCode  (canonical)
        //   - metadata.house_type_code                        (legacy flat key)
        // Query both in parallel so the tab works for every scheme.
        const [nested, flat] = await Promise.all([
          supabase
            .from('document_sections')
            .select('id, metadata')
            .eq('project_id', supabaseUnit.project_id)
            .filter('metadata->drawing_classification->>houseTypeCode', 'eq', houseTypeCode),
          supabase
            .from('document_sections')
            .select('id, metadata')
            .eq('project_id', supabaseUnit.project_id)
            .filter('metadata->>house_type_code', 'eq', houseTypeCode),
        ]);

        const drawingSections = [
          ...(nested.data || []),
          ...(flat.data || []),
        ];

        const uniqueDocs = new Map<string, (typeof documents)[number]>();

        for (const section of drawingSections) {
          const meta = (section.metadata || {}) as Record<string, unknown>;
          // Prefer metadata.file_name per the drawing_classification schema;
          // fall back to metadata.source used by older ingestion rows.
          const fileName = (meta.file_name as string | undefined)
            || (meta.source as string | undefined)
            || null;
          if (!fileName) continue;
          if (uniqueDocs.has(fileName)) continue;

          const fileUrl = (meta.file_url as string | undefined) || null;
          const mimeType = (meta.mime_type as string | undefined) || 'application/pdf';
          const drawingClassification = (meta.drawing_classification || {}) as Record<string, unknown>;
          // `drawingType` lives in two metadata shapes depending on when the document
          // was ingested:
          //   - metadata.drawing_classification.drawingType  (nested — newer shape)
          //   - metadata.drawing_type                        (flat — older shape, used
          //                                                   by the Árdan View BS01
          //                                                   ingestion for Bug 4)
          // Read the nested path first (it carries richer sibling data) and fall back
          // to the flat key. Same pattern for drawingDescription / description.
          const drawingType =
            (drawingClassification.drawingType as string | undefined)
            || (meta.drawing_type as string | undefined)
            || null;
          const description =
            (drawingClassification.drawingDescription as string | undefined)
            || (meta.description as string | undefined)
            || null;

          uniqueDocs.set(fileName, {
            id: section.id,
            title: humaniseFileName(fileName, description),
            file_url: fileUrl,
            file_name: fileName,
            mime_type: mimeType,
            category: getDocCategory(drawingType, fileName),
            drawing_type: drawingType,
            drawing_type_label: formatDrawingTypeLabel(drawingType),
            description: description,
          });
        }

        documents.push(...Array.from(uniqueDocs.values()));

        console.log('[profile] documents resolved', JSON.stringify({
          unit_id: supabaseUnit.id,
          project_id: supabaseUnit.project_id,
          house_type_code: houseTypeCode,
          nested_matches: (nested.data || []).length,
          flat_matches: (flat.data || []).length,
          unique_files: documents.length,
        }));
      }
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

function getDocCategory(drawingType: string | null | undefined, fileName: string): string {
  // Prefer the structured classification when present — filename heuristics are
  // a weak fallback because ingestion filenames are coded (e.g. "281-MHL-BT03-
  // ZZ-DR-A-0140-...").
  const label = formatDrawingTypeLabel(drawingType);
  if (label) return pluralise(label);
  const lower = (fileName || '').toLowerCase();
  if (lower.includes('elevation')) return 'Elevations';
  if (lower.includes('section')) return 'Sections';
  if (lower.includes('floor') || lower.includes('plan') || lower.includes('layout')) return 'Floor Plans';
  if (lower.includes('spec')) return 'Specifications';
  if (lower.includes('user') || lower.includes('guide')) return 'User Guides';
  return 'Documents';
}

function formatDrawingTypeLabel(drawingType: string | null | undefined): string | null {
  if (!drawingType) return null;
  switch (drawingType) {
    case 'floor_plan':   return 'Floor Plan';
    case 'elevation':    return 'Elevation';
    case 'section':      return 'Section';
    case 'site_plan':    return 'Site Plan';
    case 'house_pad':    return 'House Pad';
    case 'room_sizes':   return 'Room Sizes';
    default:
      return drawingType
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

function pluralise(label: string): string {
  if (/s$/i.test(label)) return label;
  return `${label}s`;
}

function humaniseFileName(fileName: string, description: string | null | undefined): string {
  if (description && description.trim()) {
    return description.trim();
  }
  // Strip extension, then strip the coded prefix like "281-MHL-BT03-ZZ-DR-A-0140-"
  // (up to six hyphen-delimited tokens before the human-readable tail).
  let base = fileName.replace(/\.[a-z0-9]+$/i, '');
  base = base.replace(/^(?:[A-Z0-9]{2,6}-){3,7}/, '');
  base = base.replace(/---+/g, ' - ');
  base = base.replace(/[-_]+/g, ' ');
  base = base.replace(/\s+/g, ' ').trim();
  // Trim trailing revision markers (Rev.C03, Rev C03, rev.B, etc.)
  base = base.replace(/\s+Rev\.?\s*[A-Z]\d*$/i, '').trim();
  return base || fileName;
}
