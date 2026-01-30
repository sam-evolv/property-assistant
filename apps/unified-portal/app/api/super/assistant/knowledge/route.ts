import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('development_id');

    if (!developmentId) {
      return NextResponse.json({ error: 'development_id required' }, { status: 400 });
    }

    const { data: items, error } = await supabaseAdmin
      .from('knowledge_base')
      .select('*')
      .eq('development_id', developmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge items:', error);
      return NextResponse.json({ error: 'Failed to fetch knowledge items' }, { status: 500 });
    }

    return NextResponse.json({ items: items || [] });
  } catch (err) {
    console.error('Error in GET /api/super/assistant/knowledge:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const body = await request.json();
    const { development_id, title, content, category } = body;

    if (!development_id || !title || !content) {
      return NextResponse.json({ error: 'development_id, title, and content are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .insert({
        development_id,
        title: title.trim(),
        content: content.trim(),
        category: category || 'general',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating knowledge item:', error);
      return NextResponse.json({ error: 'Failed to create knowledge item' }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('Error in POST /api/super/assistant/knowledge:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting knowledge item:', error);
      return NextResponse.json({ error: 'Failed to delete knowledge item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/super/assistant/knowledge:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
