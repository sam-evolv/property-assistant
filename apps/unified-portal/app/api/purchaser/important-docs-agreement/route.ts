import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { purchaserAgreements } from '@openhouse/db/schema';
import { createClient } from '@supabase/supabase-js';
import { validateQRToken } from '@openhouse/api/qr-tokens';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const PUBLIC_DISCIPLINES = ['handover', 'other'];

export async function POST(request: NextRequest) {
  try {
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

    // Get purchaser info from Supabase units table
    let name = purchaserName;
    let email = null;
    
    const { data: unitData } = await supabase
      .from('units')
      .select('purchaser_name, purchaser_email')
      .eq('id', unitUid)
      .single();
    
    if (unitData) {
      name = name || unitData.purchaser_name || 'Unknown';
      email = unitData.purchaser_email;
    }

    // Get important documents that were acknowledged (only public disciplines)
    const { data: sections } = await supabase
      .from('document_sections')
      .select('id, metadata')
      .eq('project_id', PROJECT_ID);

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

    // Save agreement to database
    const [agreement] = await db
      .insert(purchaserAgreements)
      .values({
        unit_id: unitUid,
        development_id: PROJECT_ID,
        purchaser_name: name,
        purchaser_email: email,
        ip_address: forwardedFor?.split(',')[0] || null,
        user_agent: userAgent || null,
        important_docs_acknowledged: acknowledgedDocs,
        docs_version: 1,
      })
      .returning();

    console.log('[Important Docs Agreement] Recorded agreement:', {
      unitId: unitUid,
      purchaserName: name,
      agreedAt: agreement.agreed_at,
      docsCount: acknowledgedDocs.length,
    });

    return NextResponse.json({ 
      success: true, 
      agreedVersion: 1,
      agreedAt: agreement.agreed_at,
    });
  } catch (error) {
    console.error('[Important Docs Agreement Error]:', error);
    return NextResponse.json({ error: 'Failed to save agreement' }, { status: 500 });
  }
}
