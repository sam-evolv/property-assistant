import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { resolveAllowedProjectIds } from '@/lib/archive-documents';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const supabaseAdmin = getSupabaseAdmin();

    // SECURITY: resolve the project ids the session tenant may read (super_admin unrestricted)
    const isSuperAdmin = session.role === 'super_admin';
    const allowedProjectIds = isSuperAdmin ? null : await resolveAllowedProjectIds(session.tenantId);

    if (projectId && allowedProjectIds && !allowedProjectIds.includes(projectId)) {
      // Requested project does not resolve to a development in the session tenant
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch documents from document_sections table
    // tenant-scope: constrained to the session tenant's allowed project ids for non-super sessions
    let query = supabaseAdmin
      .from('document_sections')
      .select('id, title, metadata, created_at')
      .order('created_at', { ascending: false });

    if (projectId) {
      // Filter by project if specified
      query = query.eq('metadata->>project_id', projectId);
    } else if (allowedProjectIds) {
      if (allowedProjectIds.length === 0) {
        return NextResponse.json({ documents: [], count: 0 });
      }
      query = allowedProjectIds.length === 1
        ? query.eq('project_id', allowedProjectIds[0])
        : query.in('project_id', allowedProjectIds);
    }

    const { data: sections, error: sectionsError } = await query;

    if (sectionsError) {
    }

    // Also try to count from documents table if it exists
    let docsCount = 0;
    try {
      let docsCountQuery = supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact', head: true });
      if (!isSuperAdmin) {
        // SECURITY: scope the count to the session tenant
        docsCountQuery = docsCountQuery.eq('tenant_id', session.tenantId);
      }
      const { count } = await docsCountQuery;
      docsCount = count || 0;
    } catch (e) {
      // documents table might not exist
    }

    // Combine results - use sections if available, otherwise documents count
    const documents = sections || [];
    const totalCount = Math.max(documents.length, docsCount);

    return NextResponse.json({
      documents,
      count: totalCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch documents', documents: [], count: 0 },
      { status: 500 }
    );
  }
}
