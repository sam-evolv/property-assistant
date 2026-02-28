import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const installationId = params.id;

    if (!installationId) {
      return NextResponse.json(
        { error: 'Installation ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch support queries and escalations in parallel
    const [queriesResult, escalationsResult] = await Promise.all([
      supabase
        .from('support_queries')
        .select('id, query_text, created_at, resolved, escalated')
        .eq('installation_id', installationId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('escalations')
        .select('id, title, created_at, status, priority')
        .eq('installation_id', installationId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (queriesResult.error) {
      console.error('[Care Activity] Queries fetch error:', queriesResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch support queries' },
        { status: 500 }
      );
    }

    if (escalationsResult.error) {
      console.error('[Care Activity] Escalations fetch error:', escalationsResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch escalations' },
        { status: 500 }
      );
    }

    // Map queries to activity items
    const queryActivities = (queriesResult.data || []).map((q) => ({
      type: 'query' as const,
      message: q.query_text,
      time: q.created_at,
      status: q.escalated ? 'escalated' : q.resolved ? 'resolved' : 'pending',
    }));

    // Map escalations to activity items
    const escalationActivities = (escalationsResult.data || []).map((e) => ({
      type: 'escalation' as const,
      message: e.title,
      time: e.created_at,
      status: e.status,
    }));

    // Combine and sort by time descending, limit to 20
    const activity = [...queryActivities, ...escalationActivities]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);

    return NextResponse.json(activity);
  } catch (error) {
    console.error('[Care Activity] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
