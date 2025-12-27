import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateQRToken } from '@openhouse/api/qr-tokens';

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

    // Get unit info and project from Supabase
    const { data: unitData, error: unitError } = await supabase
      .from('units')
      .select('id, purchaser_name, project_id')
      .eq('id', unitUid)
      .single();
    
    if (unitError || !unitData) {
      console.error('[Important Docs Agreement] Unit not found:', unitUid, unitError);
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const projectId = unitData.project_id || PROJECT_ID;

    // Get the current important docs version from the project
    const { data: projectData } = await supabase
      .from('projects')
      .select('important_docs_version')
      .eq('id', projectId)
      .single();
    
    const currentDocsVersion = projectData?.important_docs_version || 1;

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

    const agreedAt = new Date().toISOString();

    // Update the Supabase units table with the agreement
    const { error: updateError } = await supabase
      .from('units')
      .update({
        important_docs_agreed_version: currentDocsVersion,
        important_docs_agreed_at: agreedAt,
      })
      .eq('id', unitUid);

    if (updateError) {
      console.error('[Important Docs Agreement] Failed to update unit:', updateError);
      return NextResponse.json({ error: 'Failed to save agreement' }, { status: 500 });
    }

    console.log('[Important Docs Agreement] Recorded agreement:', {
      unitId: unitUid,
      purchaserName: unitData.purchaser_name || purchaserName,
      agreedAt,
      docsVersion: currentDocsVersion,
      docsCount: acknowledgedDocs.length,
    });

    return NextResponse.json({ 
      success: true, 
      agreedVersion: currentDocsVersion,
      agreedAt,
    });
  } catch (error) {
    console.error('[Important Docs Agreement Error]:', error);
    return NextResponse.json({ error: 'Failed to save agreement' }, { status: 500 });
  }
}
