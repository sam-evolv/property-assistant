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

    const { data: qas, error } = await supabaseAdmin
      .from('custom_qa')
      .select('*')
      .eq('development_id', developmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Q&As:', error);
      return NextResponse.json({ error: 'Failed to fetch Q&As' }, { status: 500 });
    }

    return NextResponse.json({ qas: qas || [] });
  } catch (err) {
    console.error('Error in GET /api/super/assistant/qa:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const body = await request.json();
    const { development_id, question, answer } = body;

    if (!development_id || !question || !answer) {
      return NextResponse.json({ error: 'development_id, question, and answer are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('custom_qa')
      .insert({
        development_id,
        question: question.trim(),
        answer: answer.trim(),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating Q&A:', error);
      return NextResponse.json({ error: 'Failed to create Q&A' }, { status: 500 });
    }

    return NextResponse.json({ qa: data });
  } catch (err) {
    console.error('Error in POST /api/super/assistant/qa:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const body = await request.json();
    const { id, question, answer, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (question !== undefined) updates.question = question.trim();
    if (answer !== undefined) updates.answer = answer.trim();
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('custom_qa')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating Q&A:', error);
      return NextResponse.json({ error: 'Failed to update Q&A' }, { status: 500 });
    }

    return NextResponse.json({ qa: data });
  } catch (err) {
    console.error('Error in PATCH /api/super/assistant/qa:', err);
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
      .from('custom_qa')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting Q&A:', error);
      return NextResponse.json({ error: 'Failed to delete Q&A' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/super/assistant/qa:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
