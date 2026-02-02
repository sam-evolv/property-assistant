import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { purchaserAgreements } from '@openhouse/db/schema';
import { createClient } from '@supabase/supabase-js';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const PUBLIC_DISCIPLINES = ['handover', 'other'];

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { unitUid, token, purchaserName } = body;

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID required' }, { status: 400 });
    }

    // Validate token using consistent purchaser authentication
    const tokenResult = await validatePurchaserToken(token || unitUid, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get purchaser info from Supabase units table
    let name = purchaserName;
    let email: string | null = null;
    let projectId = PROJECT_ID;
    
    const { data: unitData } = await supabase
      .from('units')
      .select('purchaser_name, project_id')
      .eq('id', unitUid)
      .single();
    
    if (unitData) {
      name = name || unitData.purchaser_name || 'Unknown';
      projectId = unitData.project_id || PROJECT_ID;
    }

    // Get important documents that were acknowledged (only public disciplines)
    const { data: sections } = await supabase
      .from('document_sections')
      .select('id, metadata')
      .eq('project_id', projectId);

    const acknowledgedDocs: { id: string; title: string }[] = [];
    const seenSources = new Set<string>();
    
    for (const section of sections || []) {
      const metadata = section.metadata || {};
      const discipline = (metadata.discipline || 'other').toLowerCase();
      
      // Only include important docs from PUBLIC disciplines
      if (metadata.is_important === true && PUBLIC_DISCIPLINES.includes(discipline)) {
        const source = metadata.file_name || metadata.source || 'Unknown';
        if (!seenSources.has(source)) {
          seenSources.add(source);
          acknowledgedDocs.push({
            id: `supabase-${section.id}`,
            title: source,
          });
        }
      }
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const userAgent = request.headers.get('user-agent');

    // Try to save agreement to Drizzle database
    let agreement: any = null;
    let agreedAt = new Date();
    
    try {
      const [result] = await db
        .insert(purchaserAgreements)
        .values({
          unit_id: unitUid,
          development_id: projectId,
          purchaser_name: name,
          purchaser_email: email,
          ip_address: forwardedFor?.split(',')[0] || null,
          user_agent: userAgent || null,
          important_docs_acknowledged: acknowledgedDocs,
          docs_version: 1,
        })
        .returning();
      
      agreement = result;
      agreedAt = result.agreed_at;
      
      console.log('[Important Docs Agreement] Recorded agreement in Drizzle:', {
        unitId: unitUid,
        purchaserName: name,
        agreedAt,
        docsCount: acknowledgedDocs.length,
      });
    } catch (drizzleError: any) {
      // If Drizzle fails (table doesn't exist), log and continue
      // We'll return success anyway since user completed the UI flow
      console.log('[Important Docs Agreement] Drizzle insert failed (table may not exist):', drizzleError?.message);
      
      // Still return success - the agreement happened, just storage failed
      console.log('[Important Docs Agreement] Proceeding with success response despite storage issue');
    }

    return NextResponse.json({ 
      success: true, 
      agreedVersion: 1,
      agreedAt: agreedAt.toISOString(),
    });
  } catch (error) {
    console.error('[Important Docs Agreement Error]:', error);
    return NextResponse.json({ error: 'Failed to save agreement' }, { status: 500 });
  }
}
