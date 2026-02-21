import { NextRequest } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title;
    if (body.messages !== undefined) updates.messages = body.messages;

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('ai_sessions')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', adminContext.tenantId)
      .eq('user_id', adminContext.id);

    if (error) {
      console.error('[Sessions PATCH] Error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Sessions PATCH] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
