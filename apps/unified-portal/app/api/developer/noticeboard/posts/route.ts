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
    const session = await requireRole(['developer', 'admin', 'super_admin']);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch noticeboard posts (table columns: tenant_id, development_id — there is no
    // project_id column; alias development_id so the response shape is unchanged)
    let query = supabaseAdmin
      .from('noticeboard_posts')
      .select('id, title, content, created_at, project_id:development_id')
      .order('created_at', { ascending: false });

    // SECURITY: non-super sessions only see their own tenant's posts
    if (session.role !== 'super_admin') {
      if (!session.tenantId) {
        return NextResponse.json({ posts: [], count: 0 });
      }
      query = query.eq('tenant_id', session.tenantId);
    }

    if (projectId) {
      query = query.eq('development_id', projectId);
    }

    const { data: posts, error } = await query;

    if (error) {
      // Table might not exist - return empty array
      return NextResponse.json({ posts: [], count: 0 });
    }

    return NextResponse.json({
      posts: posts || [],
      count: posts?.length || 0,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized', posts: [], count: 0 }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden', posts: [], count: 0 }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch noticeboard posts', posts: [], count: 0 },
      { status: 500 }
    );
  }
}
