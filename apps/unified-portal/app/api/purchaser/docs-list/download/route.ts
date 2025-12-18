// Clean State Route: 2025-12-18T11:20:00Z
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { documents, units } from '@openhouse/db/schema';
import { eq, or } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { logAnalyticsEvent } from '@openhouse/api/analytics-logger';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  console.log("[docs-list/download] GET handler invoked");
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');
    const docId = searchParams.get('docId');

    console.log('[docs-list/download] Request:', { unitUid, docId, tokenProvided: !!token });

    if (!unitUid || !docId) {
      return NextResponse.json(
        { error: 'Unit UID and document ID are required' },
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
      console.log('[docs-list/download] Using demo/fallback authentication');
      isAuthenticated = true;
    }
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(unitUid);
    let resolvedDevId: string | undefined;
    
    const unitResult = await db
      .select({ development_id: units.development_id })
      .from(units)
      .where(isUuid 
        ? or(eq(units.id, unitUid), eq(units.unit_uid, unitUid))
        : eq(units.unit_uid, unitUid))
      .limit(1);
    
    if (unitResult.length > 0) {
      resolvedDevId = unitResult[0].development_id;
    } else if (isUuid) {
      try {
        const supabase = getSupabaseClient();
        const { data: supabaseUnit } = await supabase
          .from('units')
          .select('project_id')
          .eq('id', unitUid)
          .single();
        
        if (supabaseUnit?.project_id) {
          const SUPABASE_TO_DRIZZLE: Record<string, string> = {
            '57dc3919-2725-4575-8046-9179075ac88e': '34316432-f1e8-4297-b993-d9b5c88ee2d8',
            '6d37c4a8-5319-4d7f-9cd2-4f1a8bc25e91': 'e0833c98-23a7-490c-9f67-b58e73aeb14e',
          };
          resolvedDevId = SUPABASE_TO_DRIZZLE[supabaseUnit.project_id];
        }
      } catch (e) {
        // Silent - just won't have development context
      }
    }

    logAnalyticsEvent({
      tenantId: DEFAULT_TENANT_ID,
      developmentId: resolvedDevId,
      eventType: 'document_open',
      eventCategory: 'document_download',
      eventData: { docId },
      sessionId: unitUid,
      unitId: unitUid,
    }).catch(() => {});

    if (docId.startsWith('supabase-')) {
      const supabase = getSupabaseClient();
      const sectionId = docId.replace('supabase-', '');
      
      const { data: section, error } = await supabase
        .from('document_sections')
        .select('metadata')
        .eq('id', sectionId)
        .single();
      
      if (error || !section) {
        console.error('[docs-list/download] Supabase section not found:', error);
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
      
      const fileUrl = section.metadata?.file_url;
      if (!fileUrl) {
        return NextResponse.json(
          { error: 'Document file URL not available' },
          { status: 404 }
        );
      }
      
      console.log('[docs-list/download] Redirecting to Supabase file:', fileUrl);
      return NextResponse.redirect(fileUrl);
    }

    const doc = await db
      .select({ file_url: documents.file_url, title: documents.title })
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1);

    if (!doc || doc.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const fileUrl = doc[0].file_url;
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Document file URL not available' },
        { status: 404 }
      );
    }

    console.log('[docs-list/download] Redirecting to Drizzle file:', fileUrl);
    return NextResponse.redirect(fileUrl);
  } catch (error) {
    console.error('[docs-list/download] ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to download document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
