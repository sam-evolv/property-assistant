import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit, isSnagSeverity, isSnagStatus } from '@/lib/dev-app/snags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoadResult =
  | { error: 'not_found' | 'forbidden' }
  | { snag: any; admin: ReturnType<typeof getSupabaseAdmin> };

/** Loads a snag via the service role, then verifies the caller owns its unit. */
async function loadOwnedSnag(userId: string, snagId: string): Promise<LoadResult> {
  const supabase = await createServerSupabaseClient();
  const admin = getSupabaseAdmin();
  const { data: snag } = await admin
    .from('snag_items')
    .select('*')
    .eq('id', snagId)
    .maybeSingle();
  if (!snag) return { error: 'not_found' };
  const owned = await getOwnedUnit(supabase, userId, snag.unit_id);
  if (!owned) return { error: 'forbidden' };
  return { snag, admin };
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await loadOwnedSnag(user.id, params.id);
    if ('error' in res) {
      return NextResponse.json(
        { error: res.error },
        { status: res.error === 'not_found' ? 404 : 403 },
      );
    }
    return NextResponse.json({ snag: res.snag });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/dev-app/snags/[id]
 * Update a snag: status transitions, assignment, triage fields, photos. Status
 * transitions set the relevant timestamps (resolved/verified/closed) server-side
 * so the audit trail and contractor scorecard stay honest.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await loadOwnedSnag(user.id, params.id);
    if ('error' in res) {
      return NextResponse.json(
        { error: res.error },
        { status: res.error === 'not_found' ? 404 : 403 },
      );
    }
    const { snag, admin } = res;

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.title === 'string') updates.title = body.title;
    if (typeof body.description === 'string') updates.description = body.description.slice(0, 4000);
    if (typeof body.trade === 'string') updates.trade = body.trade;
    if (typeof body.location === 'string') updates.location = body.location;
    if ('responsible_contractor_id' in body) {
      updates.responsible_contractor_id = body.responsible_contractor_id;
    }
    if (Array.isArray(body.photo_urls)) {
      updates.photo_urls = body.photo_urls;
      updates.photo_url = body.photo_urls[0] ?? snag.photo_url ?? null;
    }
    if (isSnagSeverity(body.severity)) updates.severity = body.severity;

    if (isSnagStatus(body.status)) {
      updates.status = body.status;
      const now = new Date().toISOString();
      if (body.status === 'resolved' && !snag.resolved_at) updates.resolved_at = now;
      if (body.status === 'verified') {
        updates.verified_at = now;
        updates.verified_by = user.id;
        if (!snag.resolved_at) updates.resolved_at = now;
      }
      if (body.status === 'verified' || body.status === 'wont_fix') updates.closed_at = now;
    }

    const { data: updated, error } = await admin
      .from('snag_items')
      .update(updates)
      .eq('id', snag.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ snag: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
