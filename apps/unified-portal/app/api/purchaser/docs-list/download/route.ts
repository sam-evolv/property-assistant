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

    // Fire-and-forget tracking - never blocks redirect
    const trackDownload = (filename: string) => {
      logAnalyticsEvent({
        tenantId: DEFAULT_TENANT_ID,
        developmentId: resolvedDevId,
        eventType: 'document_download',
        eventCategory: 'documents',
        eventData: { docId, filename },
        sessionId: unitUid,
        unitId: unitUid,
      }).catch(err => {
        console.error('[docs-list/download] Tracking failed:', err);
      });
    };

    // Generate absolute URL for file downloads
    // Priority: 1) Signed URL for Supabase storage, 2) Absolute URL
    const getAbsoluteDownloadUrl = async (
      supabase: ReturnType<typeof getSupabaseClient>, 
      fileUrl: string,
      requestUrl: string
    ): Promise<string> => {
      console.log('[docs-list/download] Processing fileUrl:', fileUrl);
      
      // 1. If already absolute URL with Supabase storage, generate signed URL
      if (fileUrl.startsWith('https://') || fileUrl.startsWith('http://')) {
        try {
          const urlObj = new URL(fileUrl);
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
          
          if (pathMatch) {
            const [, bucket, path] = pathMatch;
            const { data, error } = await supabase.storage
              .from(bucket)
              .createSignedUrl(decodeURIComponent(path), 60);
            
            if (!error && data?.signedUrl) {
              console.log('[docs-list/download] Generated signed URL for storage file');
              return data.signedUrl;
            }
            console.error('[docs-list/download] Signed URL error:', error);
          }
          // Already absolute URL, return as-is
          return fileUrl;
        } catch (e) {
          console.error('[docs-list/download] URL parsing error:', e);
          return fileUrl;
        }
      }
      
      // 2. For relative paths (/uploads/...), convert to absolute URL
      // These files are served statically from the app, not from Supabase storage
      // We must encode URI components to handle spaces safely (My Plan.pdf -> My%20Plan.pdf)
      try {
        const baseUrl = new URL(requestUrl);
        const origin = baseUrl.origin; // e.g., https://xxx.replit.dev
        
        // Remove leading slash and encode each path segment to handle spaces
        const cleanPath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
        const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const absoluteUrl = `${origin}/${encodedPath}`;
        
        console.log('[docs-list/download] Created absolute URL:', absoluteUrl);
        return absoluteUrl;
      } catch (e) {
        console.error('[docs-list/download] Failed to create absolute URL:', e);
        // Last resort - this should never fail
        throw new Error(`Cannot create absolute URL from: ${fileUrl}`);
      }
    };

    const supabase = getSupabaseClient();

    if (docId.startsWith('supabase-')) {
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
      
      const filename = section.metadata?.title || `document-${sectionId}.pdf`;
      
      // Get absolute URL (signed or direct) - NEVER redirect to relative path
      const redirectUrl = await getAbsoluteDownloadUrl(supabase, fileUrl, request.url);
      
      console.log('[docs-list/download] Redirecting Supabase doc to:', redirectUrl.substring(0, 80) + '...');
      
      // Track (fire-and-forget) then 307 redirect to signed URL
      trackDownload(filename);
      return NextResponse.redirect(redirectUrl, 307);
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

    const filename = doc[0].title || `document-${docId}.pdf`;
    
    // Get absolute URL (signed or direct) - NEVER redirect to relative path
    const redirectUrl = await getAbsoluteDownloadUrl(supabase, fileUrl, request.url);
    
    console.log('[docs-list/download] Redirecting Drizzle doc to:', redirectUrl.substring(0, 80) + '...');
    
    // Track (fire-and-forget) then 307 redirect to signed URL
    trackDownload(filename);
    return NextResponse.redirect(redirectUrl, 307);
  } catch (error) {
    console.error('[docs-list/download] ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to download document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
