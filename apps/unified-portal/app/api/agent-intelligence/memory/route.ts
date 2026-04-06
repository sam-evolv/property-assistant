import { NextRequest } from 'next/server';
import { getAdminContextFromSession, enforceTenantScope } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent-intelligence/memory
 * Retrieve conversation memory for the current agent, optionally filtered by entity.
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tenantId = enforceTenantScope(adminContext);
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type'); // 'buyer', 'unit', 'scheme'
    const entityValue = searchParams.get('entity_value');
    const sessionId = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get agent profile
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('user_id', adminContext.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ conversations: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let query = supabase
      .from('intelligence_conversations')
      .select('*')
      .eq('agent_id', profile.id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    // Filter by entity if specified
    if (entityType && entityValue) {
      const key = entityType === 'buyer' ? 'buyers'
        : entityType === 'unit' ? 'units'
        : 'schemes';
      query = query.contains('entities_mentioned', { [key]: [entityValue.toLowerCase()] });
    }

    const { data: conversations, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to load memory' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ conversations: conversations || [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
