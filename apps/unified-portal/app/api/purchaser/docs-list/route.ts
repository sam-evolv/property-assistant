// Clean State Route: 2025-12-18T11:20:00Z
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { logAnalyticsEvent } from '@openhouse/api/analytics-logger';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
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
      isAuthenticated = true;
    }
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    let supabaseProjectId: string | null = null;
    let houseTypeCode: string | null = null;
    
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
    }

    if (!supabaseProjectId) {
      supabaseProjectId = PROJECT_ID;
    }
    
    console.log('[DocsListAPI] Resolved project_id:', supabaseProjectId, 'houseType:', houseTypeCode);

    logAnalyticsEvent({
      tenantId: DEFAULT_TENANT_ID,
      developmentId: supabaseProjectId || undefined,
      houseTypeCode: houseTypeCode || undefined,
      eventType: 'qr_scan',
      eventCategory: 'docs_access',
      sessionId: unitUid,
      unitId: unitUid,
    }).catch(() => {});
    
    const normalizedHouseType = (houseTypeCode || '').toLowerCase();

    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id, metadata')
      .eq('project_id', supabaseProjectId);

    if (sectionsError) {
      console.error('[DocsListAPI] Supabase sections error:', sectionsError.message);
    }

    const documentMap = new Map<string, any>();
    
    for (const section of sections || []) {
      const metadata = section.metadata || {};
      const source = metadata.source || metadata.file_name || 'Unknown';
      
      if (!documentMap.has(source)) {
        documentMap.set(source, {
          id: section.id,
          title: source,
          file_name: metadata.file_name || source,
          file_url: metadata.file_url || null,
          discipline: (metadata.discipline || 'general').toLowerCase(),
          is_important: metadata.is_important === true,
          must_read: metadata.must_read === true,
          category: metadata.category || 'general',
          created_at: new Date().toISOString(),
        });
      }
    }

    console.log('[DocsListAPI] Found', documentMap.size, 'unique documents from Supabase');

    const formattedDocs = Array.from(documentMap.values()).map((doc) => {
      return {
        id: doc.id,
        title: doc.title,
        file_url: doc.file_url,
        file_type: 'application/pdf',
        created_at: doc.created_at,
        metadata: { discipline: doc.discipline, category: doc.category },
        is_house_specific: false,
        is_important: doc.is_important,
        important_rank: doc.is_important ? 1 : null,
        must_read: doc.must_read,
        source: 'supabase',
      };
    });

    console.log(`[docs-list] OK: unit=${unitUid}, total=${formattedDocs.length} docs`);
    
    return NextResponse.json({ documents: formattedDocs });
  } catch (error) {
    console.error('[docs-list] ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
