import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: actions } = await supabase
      .from('intelligence_actions')
      .select('id, action_type, description, created_at, development_id')
      .eq('developer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Enrich with development names
    const devIds = [
      ...new Set((actions || []).map((a) => a.development_id).filter(Boolean)),
    ];

    let devNameMap: Record<string, string> = {};
    if (devIds.length > 0) {
      const { data: devs } = await supabase
        .from('developments')
        .select('id, name')
        .in('id', devIds);

      devNameMap = Object.fromEntries(
        (devs || []).map((d) => [d.id, d.name])
      );
    }

    const enriched = (actions || []).map((a) => ({
      ...a,
      development_name: a.development_id
        ? devNameMap[a.development_id]
        : undefined,
    }));

    return NextResponse.json({ actions: enriched });
  } catch (error) {
    console.error('[dev-app/intelligence/actions] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
