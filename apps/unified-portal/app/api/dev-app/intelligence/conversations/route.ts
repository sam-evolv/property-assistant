import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';

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

    const { data: conversations } = await supabase
      .from('intelligence_conversations')
      .select('id, title, updated_at, message_count, is_archived')
      .eq('developer_id', user.id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('[dev-app/intelligence/conversations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const admin = getSupabaseAdmin();

    const { data: conversation } = await admin
      .from('intelligence_conversations')
      .insert({
        developer_id: user.id,
        title: body.title || 'New Conversation',
        development_id: body.development_id || null,
      })
      .select('id')
      .single();

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('[dev-app/intelligence/conversations] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
