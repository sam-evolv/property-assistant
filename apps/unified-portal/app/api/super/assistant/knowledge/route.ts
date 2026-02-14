import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    const supabaseAdmin = getSupabaseAdmin();
    
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('development_id');
    const includePlatformWide = searchParams.get('include_platform_wide') === 'true';

    if (!developmentId) {
      return NextResponse.json({ error: 'development_id required' }, { status: 400 });
    }

    // Fetch development-specific items
    const { data: devItems, error: devError } = await supabaseAdmin
      .from('knowledge_base')
      .select('*')
      .eq('development_id', developmentId)
      .order('created_at', { ascending: false });

    if (devError) {
      console.error('Error fetching knowledge items:', devError);
      return NextResponse.json({ error: 'Failed to fetch knowledge items' }, { status: 500 });
    }

    let platformItems: any[] = [];
    if (includePlatformWide) {
      // Fetch platform-wide items (development_id is null or 'platform')
      const { data: platItems } = await supabaseAdmin
        .from('knowledge_base')
        .select('*')
        .or('development_id.is.null,development_id.eq.platform')
        .order('created_at', { ascending: false });
      
      platformItems = platItems || [];
    }

    return NextResponse.json({ 
      items: devItems || [],
      platformItems,
    });
  } catch (err) {
    console.error('Error in GET /api/super/assistant/knowledge:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    const supabaseAdmin = getSupabaseAdmin();
    
    const body = await request.json();
    const { development_id, title, content, category, source_url, is_platform_wide } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
    }

    // Use 'platform' as development_id for platform-wide knowledge
    const effectiveDevId = is_platform_wide ? 'platform' : development_id;

    if (!effectiveDevId && !is_platform_wide) {
      return NextResponse.json({ error: 'development_id is required for non-platform items' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .insert({
        development_id: effectiveDevId,
        title: title.trim(),
        content: content.trim(),
        category: category || 'general',
        source_url: source_url || null,
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

// Bulk import endpoint
export async function PUT(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    const supabaseAdmin = getSupabaseAdmin();
    
    const body = await request.json();
    const { items, development_id, is_platform_wide } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const effectiveDevId = is_platform_wide ? 'platform' : development_id;

    if (!effectiveDevId && !is_platform_wide) {
      return NextResponse.json({ error: 'development_id is required for non-platform items' }, { status: 400 });
    }

    // Prepare items for insert
    const insertItems = items.map(item => ({
      development_id: effectiveDevId,
      title: item.title?.trim() || 'Untitled',
      content: item.content?.trim() || '',
      category: item.category || 'general',
      source_url: item.source_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })).filter(item => item.content.length > 0);

    if (insertItems.length === 0) {
      return NextResponse.json({ error: 'No valid items to import' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .insert(insertItems)
      .select();

    if (error) {
      console.error('Error bulk importing knowledge items:', error);
      return NextResponse.json({ error: 'Failed to import items' }, { status: 500 });
    }

    return NextResponse.json({ 
      imported: data?.length || 0,
      items: data 
    });
  } catch (err) {
    console.error('Error in PUT /api/super/assistant/knowledge:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    const supabaseAdmin = getSupabaseAdmin();
    
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
