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
  return createClient(url!, key!);
}

// Mirrors the extractor in docs-list/route.ts so house-type scoping is consistent
// across the consent modal and the Documents tab.
function extractHouseTypeFromFilename(filename: string): string | null {
  const patterns = [
    /House-Type-([A-Z]{1,3}\d{1,2})/i,
    /Type-([A-Z]{1,3}\d{1,2})/i,
    /[-_]([A-Z]{1,3}\d{1,2})[-_]/i,
    /^([A-Z]{1,3}\d{1,2})[-_]/i,
  ];
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) return match[1].toUpperCase();
  }
  return null;
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
      .select('project_id, house_type_code')
      .eq('id', supabaseUnitId)
      .single();

    if (unitError || !unitData?.project_id) {
      return NextResponse.json({
        requiresConsent: false,
        importantDocuments: [],
        importantDocsCount: 0,
      });
    }

    const projectId = unitData.project_id;
    // House type for this home — used to scope house-type-specific important docs.
    const normalizedHouseType = ((unitData.house_type_code as string | null) || '')
      .toLowerCase()
      .trim();

    // Check if user has already agreed using the purchaserAgreements table
    // Wrap in try-catch in case table doesn't exist in current database
    try {
      const existingAgreement = await db
        .select()
        .from(purchaserAgreements)
        .where(eq(purchaserAgreements.unit_id, supabaseUnitId))
        .limit(1);

      if (existingAgreement.length > 0) {
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
    }

    // Fetch important documents from Supabase document_sections for THIS unit's project
    
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
      return NextResponse.json({
        requiresConsent: false,
        importantDocuments: [],
      });
    }
    
    const sections = await response.json();

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
      if (metadata.is_important !== true || !PUBLIC_DISCIPLINES.includes(discipline)) {
        continue;
      }

      const source = metadata.file_name || metadata.source || 'Unknown';

      // HOUSE-TYPE SCOPING (mirror docs-list): a document tagged for a specific
      // house type must match the homeowner's house type. Documents with no
      // house type are development-wide (e.g. Home User Guide) and shown to all.
      const drawingClassification = metadata.drawing_classification || {};
      const docHouseType =
        metadata.house_type_code ||
        drawingClassification.houseTypeCode ||
        extractHouseTypeFromFilename(source);
      const normalizedDocHouseType = (docHouseType || '').toLowerCase().trim();
      if (normalizedDocHouseType && normalizedDocHouseType !== normalizedHouseType) {
        continue;
      }

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

    const importantDocuments = Array.from(importantDocsMap.values())
      .sort((a, b) => (a.important_rank || 999) - (b.important_rank || 999));
    
    return NextResponse.json({
      requiresConsent: importantDocuments.length > 0,
      hasAgreed: false,
      currentVersion: 1,
      agreedVersion: 0,
      importantDocuments,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
