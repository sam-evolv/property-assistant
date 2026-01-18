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

    // Fetch noticeboard posts
    let query = supabaseAdmin
      .from('noticeboard_posts')
      .select('id, title, content, created_at, project_id')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('[Noticeboard API] Error fetching posts:', error);
      // Table might not exist - return empty array
      return NextResponse.json({ posts: [], count: 0 });
    }

    console.log(`[Noticeboard API] Found ${posts?.length || 0} posts`);

    return NextResponse.json({
      posts: posts || [],
      count: posts?.length || 0,
    });
  } catch (error) {
    console.error('[Noticeboard API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch noticeboard posts', posts: [], count: 0 },
      { status: 500 }
    );
  }
}
