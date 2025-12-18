// Clean State Route: 2025-12-18T11:20:00Z
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { documents, units } from '@openhouse/db/schema';
import { eq, or } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { createClient } from '@supabase/supabase-js';

console.log("[docs-list/download] Route module loaded");

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
