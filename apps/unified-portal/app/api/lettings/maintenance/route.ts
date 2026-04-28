import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIES = new Set([
  'plumbing', 'electrical', 'heating', 'appliance', 'structural',
  'pest', 'cleaning', 'safety', 'compliance', 'other',
]);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

/** POST /api/lettings/maintenance — creates a maintenance ticket on a property. */
export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const lettingPropertyId = body.lettingPropertyId;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (typeof lettingPropertyId !== 'string' || !lettingPropertyId) {
      return NextResponse.json({ error: 'lettingPropertyId is required' }, { status: 400 });
    }
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const description = typeof body.description === 'string' ? body.description : null;
    const category = body.category != null ? String(body.category) : null;
    if (category !== null && !CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    const priority = body.priority != null ? String(body.priority) : 'medium';
    if (!PRIORITIES.has(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const { data: property } = await admin
      .from('agent_letting_properties')
      .select('id, agent_id, workspace_id')
      .eq('id', lettingPropertyId)
      .maybeSingle();
    if (!property || property.agent_id !== agentProfile.id) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const { data: activeTenancy } = await admin
      .from('agent_tenancies')
      .select('id')
      .eq('letting_property_id', lettingPropertyId)
      .eq('status', 'active')
      .maybeSingle();

    console.log(`[lettings-maintenance] create_start property=${lettingPropertyId} priority=${priority}`);

    const { data: inserted, error: insErr } = await admin
      .from('lettings_maintenance')
      .insert({
        letting_property_id: lettingPropertyId,
        tenancy_id: activeTenancy?.id ?? null,
        workspace_id: property.workspace_id,
        agent_id: agentProfile.id,
        tenant_id: agentProfile.tenant_id,
        title,
        description,
        category,
        priority,
        status: 'open',
      })
      .select('id, title, description, category, priority, status, reported_at, resolved_at')
      .single();
    if (insErr || !inserted) {
      console.error(`[lettings-maintenance] create_failed reason=${insErr?.message}`);
      return NextResponse.json({ error: insErr?.message ?? 'Insert failed' }, { status: 500 });
    }

    console.log(`[lettings-maintenance] create_ok id=${inserted.id} duration_ms=${Date.now() - started}`);
    return NextResponse.json({
      ok: true,
      ticket: {
        id: inserted.id,
        title: inserted.title,
        description: inserted.description,
        category: inserted.category,
        priority: inserted.priority,
        status: inserted.status,
        reportedAt: inserted.reported_at,
        resolvedAt: inserted.resolved_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-maintenance] error reason=${message}`);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
