// Clean State Route: 2025-12-18T11:20:00Z
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { documents, units } from '@openhouse/db/schema';
import { eq, and, asc, or, sql } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { createClient } from '@supabase/supabase-js';

console.log("[docs-list] Route module loaded");

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const DRIZZLE_TO_SUPABASE_MAP: Record<string, string> = {
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': '57dc3919-2725-4575-8046-9179075ac88e',
  'e0833c98-23a7-490c-9f67-b58e73aeb14e': '6d37c4a8-5319-4d7f-9cd2-4f1a8bc25e91',
};

const SUPABASE_TO_DRIZZLE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(DRIZZLE_TO_SUPABASE_MAP).map(([k, v]) => [v, k])
);

function getSupabaseProjectId(drizzleId: string): string | null {
  return DRIZZLE_TO_SUPABASE_MAP[drizzleId] || null;
}

function getDrizzleDevelopmentId(supabaseId: string): string | null {
  return SUPABASE_TO_DRIZZLE_MAP[supabaseId] || null;
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

const PUBLIC_DISCIPLINES = [
  'handover', 'other', 'architectural', 'floorplans', 'pdf',
  'electrical', 'mechanical', 'structural', 'civil', 'services',
  'plumbing', 'hvac', 'landscaping', 'interior', 'safety',
  'fire', 'drainage', 'specifications', 'general', 'warranty',
  'certificate', 'manual', 'instruction', 'user guide', 'maintenance'
];

function mapDisciplineToCategory(discipline: string, title: string): string {
  const lowerTitle = title.toLowerCase();
  const lowerDiscipline = discipline.toLowerCase();
  
  if (lowerDiscipline === 'architectural' || 
      lowerTitle.includes('floor') || 
      lowerTitle.includes('plan') || 
      lowerTitle.includes('elevation') ||
      lowerTitle.includes('layout')) {
    return 'Floorplans';
  }
  
  if (lowerTitle.includes('fire') || lowerTitle.includes('smoke') || lowerTitle.includes('alarm')) {
    return 'Fire Safety';
  }
  
  if (lowerTitle.includes('parking') || lowerTitle.includes('car park')) {
    return 'Parking';
  }
  
  if (lowerDiscipline === 'handover') {
    return 'Handover';
  }
  
  if (lowerTitle.includes('snag') || lowerTitle.includes('defect')) {
    return 'Snagging';
  }
  
  if (lowerTitle.includes('warranty') || lowerTitle.includes('guarantee') || lowerTitle.includes('cert')) {
    return 'Warranties';
  }
  
  if (lowerTitle.includes('spec') || lowerTitle.includes('technical')) {
    return 'Specifications';
  }
  
  return 'General';
}

export async function GET(request: NextRequest) {
  console.log("[docs-list] GET handler invoked");
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    console.log('[docs-list] Request received:', {
      unitUid: unitUid || 'MISSING',
      tokenProvided: !!token,
      tokenLength: token?.length || 0,
      url: request.url,
      env: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      }
    });

    if (!unitUid) {
      console.log('[docs-list] REJECTED: Missing unitUid');
      return NextResponse.json(
        { error: 'Unit UID is required' },
        { status: 400 }
      );
    }

    let isAuthenticated = false;
    if (token) {
      const payload = await validateQRToken(token);
      if (payload && payload.supabaseUnitId === unitUid) {
        isAuthenticated = true;
      }
    }
    
    if (!isAuthenticated && token && token === unitUid) {
      console.log('[docs-list] Using demo/fallback authentication for unit:', unitUid);
      isAuthenticated = true;
    }
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    let drizzleDevelopmentId: string | null = null;
    let supabaseProjectId: string | null = null;
    let houseTypeCode: string | null = null;
    
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(unitUid);
    
    const drizzleUnit = await db
      .select({ 
        development_id: units.development_id,
        house_type_code: units.house_type_code
      })
      .from(units)
      .where(isUuid 
        ? or(eq(units.id, unitUid), eq(units.unit_uid, unitUid))
        : eq(units.unit_uid, unitUid))
      .limit(1);

    if (drizzleUnit && drizzleUnit.length > 0) {
      drizzleDevelopmentId = drizzleUnit[0].development_id;
      houseTypeCode = drizzleUnit[0].house_type_code;
      console.log('[docs-list] Found unit in Drizzle:', { unitUid, drizzleDevelopmentId, houseTypeCode });
      
      const mappedSupabaseId = getSupabaseProjectId(drizzleDevelopmentId);
      if (mappedSupabaseId) {
        supabaseProjectId = mappedSupabaseId;
        console.log('[docs-list] Used direct ID mapping:', { drizzleDevelopmentId, supabaseProjectId });
      } else {
        const { rows: devRows } = await db.execute(sql`SELECT name FROM developments WHERE id = ${drizzleDevelopmentId}::uuid`);
        if (devRows.length > 0) {
          const devName = (devRows[0] as any).name;
          const supabase = getSupabaseClient();
          const { data: project } = await supabase.from('projects').select('id').ilike('name', devName).single();
          if (project) {
            supabaseProjectId = project.id;
            console.log('[docs-list] Matched Supabase project by name:', { devName, supabaseProjectId });
          }
        }
      }
    } else {
      const supabase = getSupabaseClient();
      const { data: supabaseUnit } = await supabase
        .from('units')
        .select('id, project_id, unit_types(name)')
        .eq('id', unitUid)
        .single();
      
      if (supabaseUnit) {
        supabaseProjectId = supabaseUnit.project_id;
        const unitType = Array.isArray(supabaseUnit.unit_types) 
          ? supabaseUnit.unit_types[0] 
          : supabaseUnit.unit_types;
        houseTypeCode = unitType?.name || null;
        console.log('[docs-list] Unit found in Supabase:', { unitUid, supabaseProjectId, houseTypeCode });
        
        const mappedDrizzleId = supabaseProjectId ? getDrizzleDevelopmentId(supabaseProjectId) : null;
        if (mappedDrizzleId) {
          drizzleDevelopmentId = mappedDrizzleId;
          console.log('[docs-list] Used direct ID mapping:', { supabaseProjectId, drizzleDevelopmentId });
        } else {
          const { data: project } = await supabase.from('projects').select('name').eq('id', supabaseProjectId).single();
          if (project) {
            const { rows: devRows } = await db.execute(sql`SELECT id FROM developments WHERE LOWER(name) = LOWER(${project.name})`);
            if (devRows.length > 0) {
              drizzleDevelopmentId = (devRows[0] as any).id;
              console.log('[docs-list] Matched Drizzle development by name:', { name: project.name, drizzleDevelopmentId });
            }
          }
        }
      }
    }

    if (!supabaseProjectId) {
      console.log('[docs-list] No Supabase project found, using PROJECT_ID fallback');
      supabaseProjectId = PROJECT_ID;
    }
    
    if (!drizzleDevelopmentId && supabaseProjectId) {
      try {
        const supabase = getSupabaseClient();
        const { data: project } = await supabase.from('projects').select('name').eq('id', supabaseProjectId).single();
        if (project?.name) {
          const { rows: devRows } = await db.execute(sql`SELECT id FROM developments WHERE LOWER(name) LIKE LOWER(${'%' + project.name.split(' ')[0] + '%'})`);
          if (devRows.length > 0) {
            drizzleDevelopmentId = (devRows[0] as any).id;
            console.log('[docs-list] Matched Drizzle development by partial name:', { name: project.name, drizzleDevelopmentId });
          }
        }
      } catch (e) {
        console.log('[docs-list] Failed to match Drizzle development:', e);
      }
    }
    
    if (!drizzleDevelopmentId) {
      drizzleDevelopmentId = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
      console.log('[docs-list] Using Longview Park as Drizzle development fallback');
    }
    
    const developmentId = drizzleDevelopmentId || supabaseProjectId;
    
    const normalizedHouseType = (houseTypeCode || '').toLowerCase();

    const allDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        file_url: documents.file_url,
        mime_type: documents.mime_type,
        created_at: documents.created_at,
        metadata: documents.metadata,
        house_type_code: documents.house_type_code,
        is_important: documents.is_important,
        important_rank: documents.important_rank,
        must_read: documents.must_read,
      })
      .from(documents)
      .where(and(
        eq(documents.development_id, developmentId),
        eq(documents.is_superseded, false)
      ))
      .orderBy(asc(documents.created_at));

    const allHouseTypePattern = /\b([A-Z]{2,4}\d{2})\b/i;
    const myHouseTypePattern = normalizedHouseType ? new RegExp(`\\b${normalizedHouseType}\\b`, 'i') : null;
    
    const docs = allDocs.filter((doc) => {
      const metadata = doc.metadata as any || {};
      
      if (metadata.is_global === true || metadata.is_global === 'true') {
        return true;
      }
      
      if (!normalizedHouseType) {
        return true;
      }
      
      const houseTypesArray = metadata.house_types || metadata.houseTypes;
      if (Array.isArray(houseTypesArray) && houseTypesArray.length > 0) {
        return houseTypesArray.some((type: string) => 
          type && typeof type === 'string' && type.toLowerCase() === normalizedHouseType
        );
      }
      
      if (metadata.unit_type && typeof metadata.unit_type === 'string') {
        return metadata.unit_type.toLowerCase() === normalizedHouseType;
      }
      
      if (doc.house_type_code && typeof doc.house_type_code === 'string') {
        return doc.house_type_code.toLowerCase() === normalizedHouseType;
      }
      
      if (doc.title && myHouseTypePattern && myHouseTypePattern.test(doc.title)) {
        return true;
      }
      
      if (doc.title && allHouseTypePattern.test(doc.title)) {
        const match = doc.title.match(allHouseTypePattern);
        if (match && match[1].toLowerCase() !== normalizedHouseType) {
          return false;
        }
      }
      
      return true;
    });

    const formattedDocs = docs.map((doc) => {
      const metadata = doc.metadata as any || {};
      
      let isHouseSpecific = false;
      const houseTypesArray = metadata.house_types || metadata.houseTypes;
      if (Array.isArray(houseTypesArray) && houseTypesArray.length > 0) {
        const hasMatch = houseTypesArray.some((type: string) => 
          type && typeof type === 'string' && type.toLowerCase() === normalizedHouseType
        );
        if (hasMatch) isHouseSpecific = true;
      }
      if (metadata.unit_type && typeof metadata.unit_type === 'string' && 
          metadata.unit_type.toLowerCase() === normalizedHouseType) {
        isHouseSpecific = true;
      }
      if (Array.isArray(metadata.tags) && metadata.tags.length > 0) {
        const tagsStr = metadata.tags.join(' ');
        if (myHouseTypePattern && myHouseTypePattern.test(tagsStr)) isHouseSpecific = true;
      }
      if (doc.house_type_code && typeof doc.house_type_code === 'string' && 
          doc.house_type_code.toLowerCase() === normalizedHouseType) {
        isHouseSpecific = true;
      }
      if (doc.title && myHouseTypePattern && myHouseTypePattern.test(doc.title)) {
        isHouseSpecific = true;
      }
      
      return {
        id: doc.id,
        title: doc.title,
        file_url: doc.file_url,
        file_type: doc.mime_type,
        created_at: doc.created_at,
        metadata: doc.metadata,
        is_house_specific: isHouseSpecific,
        is_important: doc.is_important,
        important_rank: doc.important_rank,
        must_read: doc.must_read,
        source: 'drizzle',
      };
    });

    let supabaseSections: any[] | null = null;
    let supabaseWarning: string | null = null;
    
    try {
      console.log(`[docs-list] Fetching from Supabase for project: ${supabaseProjectId}`);
      
      const supabaseClient = getSupabaseClient();
      
      const { data, error: supabaseError } = await supabaseClient
        .from('document_sections')
        .select('id, content, metadata', { count: 'exact', head: false })
        .eq('project_id', supabaseProjectId)
        .limit(500);

      if (supabaseError) {
        console.error('[docs-list] Supabase query error:', supabaseError.message, supabaseError.details, supabaseError.hint);
        supabaseWarning = `Supabase query failed: ${supabaseError.message}`;
      } else {
        supabaseSections = data;
        console.log(`[docs-list] Found ${supabaseSections?.length || 0} sections from Supabase`);
      }
    } catch (supabaseErr) {
      console.error('[docs-list] Supabase connection failed:', supabaseErr);
      supabaseWarning = `Supabase connection failed: ${supabaseErr instanceof Error ? supabaseErr.message : 'Unknown error'}`;
    }

    const supabaseDocMap = new Map<string, {
      id: string;
      title: string;
      file_url: string;
      discipline: string;
      created_at: string;
      is_important: boolean;
      important_rank: number | null;
      must_read: boolean;
    }>();

    if (supabaseSections) {
      const disciplineCounts: Record<string, number> = {};
      let mustReadCount = 0;
      const userHouseType = (houseTypeCode || '').toUpperCase();
      console.log('[docs-list] User house type:', userHouseType);
      
      const houseTypePattern = /\b([A-Z]{2,4}\d{2})\b/i;
      
      for (const section of supabaseSections) {
        const metadata = section.metadata || {};
        const source = metadata.file_name || metadata.source || 'Unknown';
        const discipline = (metadata.discipline || 'other').toLowerCase();
        const isImportant = metadata.is_important === true;
        const hasMustReadFlag = metadata.must_read === true;
        const isMustRead = isImportant || hasMustReadFlag;
        
        if (isMustRead) mustReadCount++;
        
        disciplineCounts[discipline] = (disciplineCounts[discipline] || 0) + 1;
        
        const sourceUpper = source.toUpperCase();
        const hasHouseTypeInName = houseTypePattern.test(sourceUpper);
        
        if (hasHouseTypeInName && userHouseType) {
          if (!sourceUpper.includes(userHouseType)) {
            continue;
          }
        }
        
        if (!supabaseDocMap.has(source)) {
          supabaseDocMap.set(source, {
            id: `supabase-${section.id}`,
            title: source,
            file_url: metadata.file_url || '',
            discipline: discipline,
            created_at: new Date().toISOString(),
            is_important: isImportant,
            important_rank: metadata.important_rank || null,
            must_read: isMustRead,
          });
        } else if (isMustRead) {
          const existing = supabaseDocMap.get(source)!;
          existing.must_read = true;
          existing.is_important = existing.is_important || isImportant;
        }
      }
      console.log(`[docs-list] Disciplines found:`, disciplineCounts);
      console.log(`[docs-list] Must-read sections total:`, mustReadCount);
    }

    const supabaseDocs = Array.from(supabaseDocMap.values()).map(doc => ({
      id: doc.id,
      title: doc.title,
      file_url: doc.file_url,
      file_type: 'application/pdf',
      created_at: doc.created_at,
      metadata: { 
        category: mapDisciplineToCategory(doc.discipline, doc.title),
        discipline: doc.discipline,
        is_important: doc.is_important,
        important_rank: doc.important_rank,
        must_read: doc.must_read,
      },
      is_house_specific: false,
      is_important: doc.is_important || false,
      important_rank: doc.important_rank || null,
      must_read: doc.must_read || false,
      source: 'supabase',
    }));
    
    console.log(`[docs-list] Must-read docs from Supabase:`, supabaseDocs.filter(d => d.must_read).length);

    const allDocuments = [...supabaseDocs, ...formattedDocs];

    console.log('[docs-list] === FINAL SUMMARY ===');
    console.log(`[docs-list] Unit: ${unitUid}`);
    console.log(`[docs-list] Project ID: ${supabaseProjectId}`);
    console.log(`[docs-list] Development ID: ${drizzleDevelopmentId || 'N/A'}`);
    console.log(`[docs-list] Drizzle docs: ${formattedDocs.length}`);
    console.log(`[docs-list] Supabase docs: ${supabaseDocs.length}`);
    console.log(`[docs-list] TOTAL: ${allDocuments.length} documents`);
    if (supabaseWarning) {
      console.warn(`[docs-list] Warning: ${supabaseWarning}`);
    }

    const response: { documents: any[], warning?: string } = { documents: allDocuments };
    if (supabaseWarning && allDocuments.length === 0) {
      response.warning = supabaseWarning;
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('[docs-list] ERROR:', error);
    console.error('[docs-list] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Failed to fetch documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
