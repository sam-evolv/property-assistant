export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const DEVELOPMENT_TO_SUPABASE_PROJECT: Record<string, string> = {
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': '57dc3919-2725-4575-8046-9179075ac88e',
  'e0833063-55ac-4201-a50e-f329c090fbd6': '6d3789de-2e46-430c-bf31-22224bd878da',
  '39c49eeb-54a6-4b04-a16a-119012c531cb': '9598cf36-3e3f-4b7d-be6d-d1e80f708f46',
  '84a559d1-89f1-4eb6-a48b-7ca068bcc164': '84a559d1-89f1-4eb6-a48b-7ca068bcc164',
};

function getSupabaseProjectId(developmentId: string): string {
  return DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId] || developmentId;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');

    if (!developmentId) {
      return NextResponse.json({ error: 'developmentId is required' }, { status: 400 });
    }

    const projectId = getSupabaseProjectId(developmentId);
    const supabase = getSupabaseClient();

    console.log('[Important Docs API] Fetching for development:', developmentId, '-> project:', projectId);

    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id, content, metadata')
      .eq('project_id', projectId);

    if (sectionsError) {
      console.error('[Important Docs API] Supabase error:', sectionsError.message);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    const documentMap = new Map<string, any>();

    for (const section of sections || []) {
      const metadata = section.metadata || {};
      const source = metadata.source || metadata.file_name || 'Unknown';

      if (!documentMap.has(source)) {
        documentMap.set(source, {
          id: section.id,
          title: source,
          original_file_name: metadata.file_name || source,
          mime_type: metadata.mime_type || 'application/pdf',
          size_kb: metadata.size_kb || null,
          file_url: metadata.file_url || null,
          version: metadata.version || 1,
          is_important: metadata.is_important === true,
          must_read: metadata.must_read === true,
          important_rank: metadata.important_rank || null,
          created_at: metadata.created_at || new Date().toISOString(),
        });
      }
    }

    const docs = Array.from(documentMap.values());

    console.log('[Important Docs API] Total docs:', docs.length, 
      'Important:', docs.filter((d: any) => d.is_important).length,
      'Must-read:', docs.filter((d: any) => d.must_read).length);

    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error('[Important Docs API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
