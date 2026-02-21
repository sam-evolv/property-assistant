import { NextRequest } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(supabase: ReturnType<typeof getSupabaseAdmin>) {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      query: `CREATE TABLE IF NOT EXISTS ai_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID,
        development_id UUID,
        title TEXT NOT NULL DEFAULT 'New Chat',
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
    });
    if (error) {
      console.warn('[Sessions] ensureTable rpc failed:', error.message);
    }
  } catch {
    // rpc not available — table likely already exists
  }
}

export async function GET() {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Ensure table exists
    await ensureTable(supabase);

    const { data: sessions, error } = await supabase
      .from('ai_sessions')
      .select('id, title, messages, development_id, created_at, updated_at')
      .eq('tenant_id', adminContext.tenantId)
      .eq('user_id', adminContext.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Sessions GET] Error:', error);
      return new Response(JSON.stringify({ sessions: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        sessions: (sessions || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          messages: s.messages || [],
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          developmentId: s.development_id,
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Sessions GET] Error:', error);
    return new Response(JSON.stringify({ sessions: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { title, developmentId, messages } = body;

    const supabase = getSupabaseAdmin();

    const { data: session, error } = await supabase
      .from('ai_sessions')
      .insert({
        tenant_id: adminContext.tenantId,
        user_id: adminContext.id,
        development_id: developmentId || null,
        title: title || 'New Chat',
        messages: messages || [],
      })
      .select('id, title, messages, development_id, created_at, updated_at')
      .single();

    if (error) {
      console.error('[Sessions POST] Error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        session: {
          id: session.id,
          title: session.title,
          messages: session.messages || [],
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          developmentId: session.development_id,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Sessions POST] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('ai_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('tenant_id', adminContext.tenantId)
      .eq('user_id', adminContext.id);

    if (error) {
      console.error('[Sessions DELETE] Error:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Sessions DELETE] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
