import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

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
    await requireRole(['developer', 'admin', 'super_admin']);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch documents from document_sections table
    let query = supabaseAdmin
      .from('document_sections')
      .select('id, title, metadata, created_at')
      .order('created_at', { ascending: false });

    if (projectId) {
      // Filter by project if specified
      query = query.eq('metadata->>project_id', projectId);
    }

    const { data: sections, error: sectionsError } = await query;

    if (sectionsError) {
      console.error('[Docs API] Error fetching document_sections:', sectionsError);
    }

    // Also try to count from documents table if it exists
    let docsCount = 0;
    try {
      const { count } = await supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact', head: true });
      docsCount = count || 0;
    } catch (e) {
      // documents table might not exist
    }

    // Combine results - use sections if available, otherwise documents count
    const documents = sections || [];
    const totalCount = Math.max(documents.length, docsCount);

    console.log(`[Docs API] Found ${documents.length} document sections, ${docsCount} documents`);

    return NextResponse.json({
      documents,
      count: totalCount,
    });
  } catch (error) {
    console.error('[Docs API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents', documents: [], count: 0 },
      { status: 500 }
    );
  }
}
