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

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    const supabaseAdmin = getSupabaseAdmin();
    
    const body = await request.json();
    const { development_id, system_instructions } = body;

    if (!development_id) {
      return NextResponse.json({ error: 'development_id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('developments')
      .update({ 
        system_instructions: system_instructions?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', development_id);

    if (error) {
      console.error('Error updating system instructions:', error);
      return NextResponse.json({ error: 'Failed to update system instructions' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in PUT /api/super/assistant/instructions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
