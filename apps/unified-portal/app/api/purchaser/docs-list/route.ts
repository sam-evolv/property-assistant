// Hardened Document Scoping API - 2025-12-27
// SECURITY: Fail closed - show nothing rather than wrong docs
// SECURITY: Cross-tenant access forbidden - documents scoped by unit→project relationship
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';
import { logAnalyticsEvent } from '@openhouse/api/analytics-logger';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { logSecurityViolation } from '@/lib/api-auth';

const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'public' },
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'x-request-id': `docs-${Date.now()}`
        }
      }
    }
  );
}

function extractHouseTypeFromFilename(filename: string): string | null {
  // Common house type patterns: BD06, BS06, A1, B2, Type-A, House-Type-BD06, etc.
  const patterns = [
    /House-Type-([A-Z]{1,3}\d{1,2})/i,  // House-Type-BD06
    /Type-([A-Z]{1,3}\d{1,2})/i,         // Type-BD06
    /[-_]([A-Z]{1,3}\d{1,2})[-_]/i,      // -BD06- or _BD06_
    /^([A-Z]{1,3}\d{1,2})[-_]/i,         // BD06- at start
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
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

    const supabase = getSupabaseClient();

    // SECURITY: Validate token matches claimed unit - cross-unit access forbidden
    const tokenResult = await validatePurchaserToken(token || unitUid, unitUid);
    
    if (!tokenResult.valid) {
      logSecurityViolation({
        request_id: requestId,
        unit_uid: unitUid,
        reason: 'Invalid or expired token in docs-list request',
      });
      return NextResponse.json(
        { error: 'Invalid or expired token', requestId, error_code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }
    
    // STEP 1: Resolve unit's project_id and house_type_code from Supabase
    // Select house_type_code directly — it is a first-class column on units.
    // The unit_types(name) join is kept as a fallback only.
    const { data: supabaseUnit, error: unitError } = await supabase
      .from('units')
      .select('id, project_id, house_type_code, unit_type_id, unit_types(name)')
      .eq('id', unitUid)
      .single();

    if (unitError || !supabaseUnit) {
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
    // Prefer the direct house_type_code column; fall back to unit_types.name if not set
    const unitType = Array.isArray(supabaseUnit.unit_types)
      ? supabaseUnit.unit_types[0]
      : supabaseUnit.unit_types;
    const houseTypeCode = (supabaseUnit.house_type_code as string | null) || unitType?.name || null;
    const normalizedHouseType = (houseTypeCode || '').toLowerCase().trim();
    
    // FAIL CLOSED: If no project_id, return empty (do NOT fallback to a default project)
    if (!projectId) {
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
    let sections: any[] = [];
    let sectionsError: any = null;
    const PAGE_SIZE = 1000;
    for (let offset = 0; offset < 20000; offset += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('document_sections')
        .select('id, content, metadata')
        .eq('project_id', projectId)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) { sectionsError = error; break; }
      if (!page || page.length === 0) break;
      sections.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    if (sectionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch documents', requestId, details: sectionsError.message },
        { status: 500 }
      );
    }

    const totalSections = sections?.length || 0;

    // STEP 3: SERVER-SIDE FILTERING - CRITICAL SECURITY
    // Only include documents that:
    // 1. Have no house_type_code (project-wide docs) OR
    // 2. Match the unit's house_type_code exactly
    const filteredReasons: string[] = [];
    const documentMap = new Map<string, {
      id: string;
      title: string;
      file_name: string;
      file_url: string | null;
      discipline: string;
      is_important: boolean;
      must_read: boolean;
      category: string;
      created_at: string;
      house_type_code: string | null;
    }>();
    let filteredOutCount = 0;
    
    for (const section of sections || []) {
      const metadata = section.metadata || {};
      const source = metadata.source || metadata.file_name || 'Unknown';
      
      // Check multiple locations for house type code
      const drawingClassification = metadata.drawing_classification || {};
      const docHouseTypeCode = metadata.house_type_code || 
                               drawingClassification.houseTypeCode || 
                               extractHouseTypeFromFilename(source);
      const normalizedDocHouseType = (docHouseTypeCode || '').toLowerCase().trim();
      
      // Drawings: architectural discipline OR source referencing a drawing set (e.g. 281-MHL project ref)
      const sectionDiscipline = (metadata.discipline || '').toLowerCase();
      const isDrawing = sectionDiscipline === 'architectural' ||
                        source.toLowerCase().includes('281-mhl');

      // SECURITY CHECK: Filter by house type
      // Drawings must ALWAYS match the homeowner's house_type_code (they are unit-specific).
      // Non-drawings are only filtered when the document itself carries a house_type_code.
      if (isDrawing) {
        if (!normalizedHouseType) {
          // Unit has no house type assigned — cannot safely show any drawings
          filteredOutCount++;
          if (!filteredReasons.includes('unit_missing_house_type')) {
            filteredReasons.push('unit_missing_house_type');
          }
          continue;
        }
        if (!normalizedDocHouseType || normalizedDocHouseType !== normalizedHouseType) {
          // Drawing is for a different (or unknown) house type — FILTER OUT
          filteredOutCount++;
          const reason = `drawing_house_type_mismatch:${normalizedDocHouseType || 'unknown'}`;
          if (!filteredReasons.includes(reason)) {
            filteredReasons.push(reason);
          }
          continue;
        }
      } else if (docHouseTypeCode && normalizedDocHouseType) {
        // Non-drawing that carries an explicit house_type_code — enforce match
        if (!normalizedHouseType) {
          filteredOutCount++;
          if (!filteredReasons.includes('unit_missing_house_type')) {
            filteredReasons.push('unit_missing_house_type');
          }
          continue;
        }
        if (normalizedDocHouseType !== normalizedHouseType) {
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
      
      // Track documents served for marketing website counter
      // Each document viewed in the list counts as served
      try {
        for (const doc of formattedDocs) {
          await logAnalyticsEvent({
            tenantId: DEFAULT_TENANT_ID,
            eventType: 'document_download',
            eventCategory: 'documents',
            eventData: { 
              docId: doc.id,
              filename: doc.title,
              source: 'docs_list_view',
              category: doc.metadata?.category,
            },
            sessionId: unitUid,
            unitId: unitUid,
          });
        }
      } catch (_trackErr) {
          // error handled silently
      }
    }

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
