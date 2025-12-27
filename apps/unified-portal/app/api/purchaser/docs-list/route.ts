// Hardened Document Scoping API - 2025-12-27
// SECURITY: Fail closed - show nothing rather than wrong docs
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { logAnalyticsEvent } from '@openhouse/api/analytics-logger';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

interface AuditLogEntry {
  requestId: string;
  unitUid: string;
  projectId: string | null;
  houseTypeCode: string | null;
  eventType: 'docs_filtered' | 'docs_empty' | 'docs_access';
  filteredCount?: number;
  filteredReasons?: string[];
  totalDocs?: number;
  returnedDocs?: number;
  timestamp: string;
}

function logAuditEvent(entry: AuditLogEntry) {
  console.log('[DocsAudit]', JSON.stringify(entry));
}

export async function GET(request: NextRequest) {
  const requestId = nanoid(12);
  const timestamp = new Date().toISOString();
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json(
        { error: 'Unit UID is required', requestId },
        { status: 400 }
      );
    }

    // AUTHENTICATION: Validate token matches unit
    let isAuthenticated = false;
    if (token) {
      const payload = await validateQRToken(token);
      if (payload && payload.supabaseUnitId === unitUid) {
        isAuthenticated = true;
      }
    }
    
    // Fallback: showhouse/demo mode (token === unitUid)
    if (!isAuthenticated && token && token === unitUid) {
      isAuthenticated = true;
    }
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Invalid or expired token', requestId },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient();
    
    // STEP 1: Resolve unit's project_id and house_type_code from Supabase
    const { data: supabaseUnit, error: unitError } = await supabase
      .from('units')
      .select('id, project_id, unit_type_id, unit_types(name)')
      .eq('id', unitUid)
      .single();
    
    if (unitError || !supabaseUnit) {
      console.error('[DocsListAPI] Unit not found:', unitUid, unitError?.message);
      logAuditEvent({
        requestId,
        unitUid,
        projectId: null,
        houseTypeCode: null,
        eventType: 'docs_empty',
        timestamp,
      });
      return NextResponse.json(
        { 
          documents: [], 
          requestId,
          message: 'No documents available for this unit yet'
        }
      );
    }

    const projectId = supabaseUnit.project_id;
    const unitType = Array.isArray(supabaseUnit.unit_types) 
      ? supabaseUnit.unit_types[0] 
      : supabaseUnit.unit_types;
    const houseTypeCode = unitType?.name || null;
    const normalizedHouseType = (houseTypeCode || '').toLowerCase().trim();
    
    console.log('[DocsListAPI] Unit resolved:', {
      requestId,
      unitUid,
      projectId,
      houseTypeCode,
      unitTypeId: supabaseUnit.unit_type_id,
    });

    // FAIL CLOSED: If no project_id, return empty (do NOT fallback to a default project)
    if (!projectId) {
      console.warn('[DocsListAPI] Unit has no project_id, failing closed:', unitUid);
      logAuditEvent({
        requestId,
        unitUid,
        projectId: null,
        houseTypeCode,
        eventType: 'docs_empty',
        timestamp,
      });
      return NextResponse.json({ 
        documents: [], 
        requestId,
        message: 'No documents available for this unit yet'
      });
    }

    // Log analytics event
    logAnalyticsEvent({
      tenantId: DEFAULT_TENANT_ID,
      developmentId: projectId,
      houseTypeCode: houseTypeCode || undefined,
      eventType: 'qr_scan',
      eventCategory: 'docs_access',
      sessionId: unitUid,
      unitId: unitUid,
    }).catch(() => {});

    // STEP 2: Fetch document_sections filtered by project_id
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id, content, metadata')
      .eq('project_id', projectId);

    if (sectionsError) {
      console.error('[DocsListAPI] Supabase sections error:', sectionsError.message);
      return NextResponse.json(
        { error: 'Failed to fetch documents', requestId, details: sectionsError.message },
        { status: 500 }
      );
    }

    const totalSections = sections?.length || 0;
    console.log('[DocsListAPI] Total sections for project:', totalSections);

    // STEP 3: SERVER-SIDE FILTERING - CRITICAL SECURITY
    // Only include documents that:
    // 1. Have no house_type_code (project-wide docs) OR
    // 2. Match the unit's house_type_code exactly
    const filteredReasons: string[] = [];
    const documentMap = new Map<string, any>();
    let filteredOutCount = 0;
    
    for (const section of sections || []) {
      const metadata = section.metadata || {};
      const source = metadata.source || metadata.file_name || 'Unknown';
      const docHouseTypeCode = metadata.house_type_code;
      const normalizedDocHouseType = (docHouseTypeCode || '').toLowerCase().trim();
      
      // SECURITY CHECK: Filter by house type
      // If document has a house_type_code, it MUST match the unit's house type
      if (docHouseTypeCode && normalizedDocHouseType) {
        if (!normalizedHouseType) {
          // Unit has no house type assigned - cannot safely show house-specific docs
          filteredOutCount++;
          if (!filteredReasons.includes('unit_missing_house_type')) {
            filteredReasons.push('unit_missing_house_type');
          }
          continue;
        }
        
        if (normalizedDocHouseType !== normalizedHouseType) {
          // Document is for a different house type - FILTER OUT
          filteredOutCount++;
          if (!filteredReasons.includes(`house_type_mismatch:${normalizedDocHouseType}`)) {
            filteredReasons.push(`house_type_mismatch:${normalizedDocHouseType}`);
          }
          continue;
        }
      }
      
      // Additional check: If metadata has unit_id or unit_uid, it must match
      const docUnitId = metadata.unit_id || metadata.unit_uid;
      if (docUnitId && docUnitId !== unitUid) {
        filteredOutCount++;
        if (!filteredReasons.includes('unit_id_mismatch')) {
          filteredReasons.push('unit_id_mismatch');
        }
        continue;
      }
      
      // Document passed all filters - add to map (deduplicate by source)
      if (!documentMap.has(source)) {
        const discipline = (metadata.discipline || 'general').toLowerCase();
        const title = source;
        documentMap.set(source, {
          id: section.id,
          title: title,
          file_name: metadata.file_name || source,
          file_url: metadata.file_url || null,
          discipline: discipline,
          is_important: metadata.is_important === true,
          must_read: metadata.must_read === true,
          category: mapDisciplineToCategory(discipline, title),
          created_at: metadata.created_at || new Date().toISOString(),
          house_type_code: docHouseTypeCode || null,
        });
      }
    }

    // AUDIT LOG: Document filtering
    if (filteredOutCount > 0) {
      logAuditEvent({
        requestId,
        unitUid,
        projectId,
        houseTypeCode,
        eventType: 'docs_filtered',
        filteredCount: filteredOutCount,
        filteredReasons,
        totalDocs: totalSections,
        returnedDocs: documentMap.size,
        timestamp,
      });
    }

    const formattedDocs = Array.from(documentMap.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      file_url: doc.file_url,
      file_type: 'application/pdf',
      created_at: doc.created_at,
      metadata: { 
        discipline: doc.discipline, 
        category: doc.category,
        house_type_code: doc.house_type_code,
      },
      is_house_specific: !!doc.house_type_code,
      is_important: doc.is_important,
      important_rank: doc.is_important ? 1 : null,
      must_read: doc.must_read,
      source: 'supabase',
    }));

    // AUDIT LOG: Empty state
    if (formattedDocs.length === 0) {
      logAuditEvent({
        requestId,
        unitUid,
        projectId,
        houseTypeCode,
        eventType: 'docs_empty',
        totalDocs: totalSections,
        filteredCount: filteredOutCount,
        filteredReasons,
        returnedDocs: 0,
        timestamp,
      });
    } else {
      logAuditEvent({
        requestId,
        unitUid,
        projectId,
        houseTypeCode,
        eventType: 'docs_access',
        totalDocs: totalSections,
        filteredCount: filteredOutCount,
        returnedDocs: formattedDocs.length,
        timestamp,
      });
    }

    console.log(`[DocsListAPI] OK: unit=${unitUid}, project=${projectId}, houseType=${houseTypeCode}, total=${totalSections}, filtered=${filteredOutCount}, returned=${formattedDocs.length}`);
    
    return NextResponse.json({ 
      documents: formattedDocs,
      requestId,
      _debug: {
        projectId,
        houseTypeCode,
        totalSections,
        filteredOut: filteredOutCount,
        returned: formattedDocs.length,
      }
    });
  } catch (error) {
    console.error('[DocsListAPI] ERROR:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch documents', 
        requestId,
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
