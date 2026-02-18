export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
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

    const supabaseAdmin = getSupabaseAdmin();

    console.log('[Documents List] Fetching for tenant:', tenantId, 'development:', developmentId);

    // First try the Drizzle-managed documents table (full schema with tenant_id / development_id)
    let documents: any[] = [];
    let usedDrizzle = false;

    try {
      const { db } = await import('@openhouse/db/client');
      const { documents: documentsTable, developments } = await import('@openhouse/db/schema');
      const { eq, and } = await import('drizzle-orm');

      const whereClause = developmentId
        ? and(eq(documentsTable.tenant_id, tenantId), eq(documentsTable.development_id, developmentId))
        : eq(documentsTable.tenant_id, tenantId);

      const rows = await db
        .select({
          id: documentsTable.id,
          title: documentsTable.title,
          original_file_name: documentsTable.original_file_name,
          file_url: documentsTable.file_url,
          version: documentsTable.version,
          is_important: documentsTable.is_important,
          important_rank: documentsTable.important_rank,
          size_kb: documentsTable.size_kb,
          development_id: documentsTable.development_id,
          created_at: documentsTable.created_at,
        })
        .from(documentsTable)
        .where(whereClause)
        .orderBy(documentsTable.created_at);

      if (rows.length > 0 || true) {
        documents = rows.map((d) => ({
          id: d.id,
          title: d.title,
          original_file_name: d.original_file_name || d.title,
          file_url: d.file_url || null,
          version: d.version ?? 1,
          is_important: d.is_important ?? false,
          important_rank: d.important_rank ?? null,
          size_kb: d.size_kb ?? 0,
          created_at: d.created_at,
        }));
        usedDrizzle = true;
        console.log('[Documents List] Drizzle returned:', documents.length, 'docs');
      }
    } catch (drizzleErr) {
      console.warn('[Documents List] Drizzle query failed, falling back to Supabase REST:', drizzleErr instanceof Error ? drizzleErr.message : 'unknown');
    }

    // Fallback: query the legacy Supabase documents table (project_id schema)
    if (!usedDrizzle) {
      let query = supabaseAdmin
        .from('documents')
        .select('id, title, file_url, created_at')
        .order('created_at', { ascending: false });

      if (developmentId) {
        query = query.eq('project_id', developmentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Documents List] Supabase fallback error:', error);
        return NextResponse.json({ documents: [], count: 0 });
      }

      documents = (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        original_file_name: d.title,
        file_url: d.file_url || null,
        version: 1,
        is_important: false,
        important_rank: null,
        size_kb: 0,
        created_at: d.created_at,
      }));

      console.log('[Documents List] Supabase fallback returned:', documents.length, 'docs');
    }

    return NextResponse.json({ documents, count: documents.length });
  } catch (error: any) {
    console.error('[Documents List] Error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ documents: [], count: 0 }, { status: 500 });
  }
}
