import { NextResponse, type NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = new Set(['open', 'in_progress', 'awaiting_contractor', 'resolved', 'cancelled']);

/** PATCH /api/lettings/maintenance/[id] — update status (mark resolved or cancel). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const started = Date.now();
  const id = params.id;
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const status = body.status;
    if (typeof status !== 'string' || !STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const update: Record<string, unknown> = { status };
    if (status === 'resolved' || status === 'cancelled') {
      update.resolved_at = new Date().toISOString();
    } else {
      update.resolved_at = null;
    }

    console.log(`[lettings-maintenance] patch id=${id} status=${status}`);

    const { data: updated, error: updErr } = await admin
      .from('lettings_maintenance')
      .update(update)
      .eq('id', id)
      .eq('agent_id', agentProfile.id)
      .select('id, title, description, category, priority, status, reported_at, resolved_at')
      .maybeSingle();
    if (updErr) {
      console.error(`[lettings-maintenance] patch_failed id=${id} reason=${updErr.message}`);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    console.log(`[lettings-maintenance] patch_ok id=${id} duration_ms=${Date.now() - started}`);
    return NextResponse.json({
      ok: true,
      ticket: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        priority: updated.priority,
        status: updated.status,
        reportedAt: updated.reported_at,
        resolvedAt: updated.resolved_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-maintenance] error id=${id} reason=${message}`);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}
