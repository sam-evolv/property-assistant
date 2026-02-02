import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { purchaserAgreements } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('[Important Docs] Supabase URL:', url?.slice(0, 30) + '...', 'Key exists:', !!key);
  return createClient(url!, key!);
}

const PUBLIC_DISCIPLINES = ['handover', 'other'];

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID required' }, { status: 400 });
    }

    // Validate token using consistent purchaser authentication
    const tokenResult = await validatePurchaserToken(token || unitUid, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    const supabaseUnitId = tokenResult.unitId || unitUid;
    
    // Get the unit's project_id to scope documents correctly (using Supabase UUID, not the QR code)
    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .select('project_id')
      .eq('id', supabaseUnitId)
      .single();
    
    if (unitError || !unitData?.project_id) {
      console.log('[Important Docs] Could not find unit project_id for supabaseUnitId:', supabaseUnitId);
      return NextResponse.json({
        requiresConsent: false,
        importantDocuments: [],
        importantDocsCount: 0,
      });
    }
    
    const projectId = unitData.project_id;
    console.log('[Important Docs] Using project_id:', projectId, 'for supabaseUnitId:', supabaseUnitId);

    // Check if user has already agreed using the purchaserAgreements table
    // Wrap in try-catch in case table doesn't exist in current database
    try {
      const existingAgreement = await db
        .select()
        .from(purchaserAgreements)
        .where(eq(purchaserAgreements.unit_id, supabaseUnitId))
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
    } catch (agreementErr) {
      // Table may not exist in current database - continue to check documents
      console.log('[Important Docs] Could not check agreements (table may not exist), continuing...');
    }

    // Fetch important documents from Supabase document_sections for THIS unit's project
    console.log('[Important Docs] Fetching sections for project_id:', projectId);
    
    // Use direct REST API call to bypass any client caching issues
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const response = await fetch(
      `${supabaseUrl}/rest/v1/document_sections?project_id=eq.${projectId}&select=id,metadata`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      }
    );
    
    if (!response.ok) {
      console.error('[Important Docs] REST API error:', response.status, response.statusText);
      return NextResponse.json({
        requiresConsent: false,
        importantDocuments: [],
      });
    }
    
    const sections = await response.json();
    console.log('[Important Docs] REST API returned:', sections?.length || 0, 'sections');

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
