import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { purchaserAgreements } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { validateQRToken } from '@openhouse/api/qr-tokens';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const PUBLIC_DISCIPLINES = ['handover', 'other'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID required' }, { status: 400 });
    }

    // Validate token - try QR token first, then fallback to unitUid match for demo
    let isAuthenticated = false;
    if (token) {
      const payload = await validateQRToken(token);
      if (payload && payload.supabaseUnitId === unitUid) {
        isAuthenticated = true;
      }
    }
    
    // Fallback: Allow demo access if token matches unitUid (UUID format)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!isAuthenticated && token && uuidPattern.test(token) && token === unitUid) {
      isAuthenticated = true;
    }
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Check if user has already agreed using the purchaserAgreements table
    const existingAgreement = await db
      .select()
      .from(purchaserAgreements)
      .where(eq(purchaserAgreements.unit_id, unitUid))
      .limit(1);

    if (existingAgreement.length > 0) {
      console.log('[Important Docs] User has existing agreement:', existingAgreement[0].agreed_at);
      return NextResponse.json({
        requiresConsent: false,
        hasAgreed: true,
        agreedAt: existingAgreement[0].agreed_at,
        agreedBy: existingAgreement[0].purchaser_name,
        importantDocuments: [],
      });
    }

    // Fetch important documents from Supabase document_sections
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata')
      .eq('project_id', PROJECT_ID);

    if (error) {
      console.error('[Important Docs] Supabase error:', error.message);
      return NextResponse.json({
        requiresConsent: false,
        importantDocuments: [],
      });
    }

    // Find unique documents marked as important AND in public disciplines only
    const importantDocsMap = new Map<string, {
      id: string;
      title: string;
      original_file_name: string;
      file_url: string;
      important_rank: number | null;
    }>();

    for (const section of sections || []) {
      const metadata = section.metadata || {};
      const discipline = (metadata.discipline || 'other').toLowerCase();
      
      // Only include important docs from PUBLIC disciplines
      if (metadata.is_important === true && PUBLIC_DISCIPLINES.includes(discipline)) {
        const source = metadata.file_name || metadata.source || 'Unknown';
        if (!importantDocsMap.has(source)) {
          importantDocsMap.set(source, {
            id: `supabase-${section.id}`,
            title: source,
            original_file_name: source,
            file_url: metadata.file_url || '',
            important_rank: metadata.important_rank || null,
          });
        }
      }
    }

    const importantDocuments = Array.from(importantDocsMap.values())
      .sort((a, b) => (a.important_rank || 999) - (b.important_rank || 999));
    
    console.log('[Important Docs Status] Found', importantDocuments.length, 'important documents for unit:', unitUid);

    return NextResponse.json({
      requiresConsent: importantDocuments.length > 0,
      hasAgreed: false,
      currentVersion: 1,
      agreedVersion: 0,
      importantDocuments,
    });
  } catch (error) {
    console.error('[Important Docs Status Error]:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
