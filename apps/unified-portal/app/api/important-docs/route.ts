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

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

    const supabase = getSupabaseAdmin();
    const supabaseProjectId = getSupabaseProjectId(developmentId);

    // Also try name-based lookup if no hardcoded mapping
    let projectId = supabaseProjectId;
    if (projectId === developmentId && !DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId]) {
      const { data: dev } = await supabase
        .from('developments')
        .select('id, name')
        .eq('id', developmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (dev?.name) {
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('name', dev.name)
          .maybeSingle();
        if (project?.id) {
          projectId = project.id;
        }
      }
    }

    // Fetch from Supabase document_sections (source of truth for archive)
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, metadata, content, project_id')
      .eq('project_id', projectId);

    if (error) {
      console.error('[Important Docs API] Supabase error:', error.message);
      return NextResponse.json({ documents: [] });
    }

    // Deduplicate by file name (same as archive view)
    const documentMap = new Map<string, any>();
    for (const section of sections || []) {
      const source = section.metadata?.source || section.metadata?.file_name || 'Unknown';
      if (!documentMap.has(source)) {
        documentMap.set(source, {
          id: section.id,
          title: source.replace(/\.[^.]+$/, ''),
          original_file_name: source,
          file_name: section.metadata?.file_name || source,
          mime_type: section.metadata?.mime_type || 'application/pdf',
          size_kb: section.metadata?.size_kb || 0,
          file_url: section.metadata?.file_url || null,
          version: 1,
          is_important: section.metadata?.is_important === true,
          must_read: section.metadata?.must_read === true,
          important_rank: section.metadata?.important_rank || null,
          discipline: section.metadata?.discipline || 'other',
          created_at: new Date().toISOString(),
        });
      }
    }

    const docs = Array.from(documentMap.values());
    return NextResponse.json({ documents: docs });
  } catch (error: any) {
    console.error('[Important Docs API Error]:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
