import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit, isSnagSeverity, type SnagSeverity } from '@/lib/dev-app/snags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/dev-app/snags
 * Create a snag against a unit.
 *
 * Offline-safe: when the client sends an `offline_client_id`, replaying a queued
 * create after reconnect returns the existing row instead of duplicating it
 * (backed by the snag_items_offline_client_uniq partial unique index).
 *
 * Tenant/development scoping is enforced in app code: authenticate with the
 * cookie client, verify development ownership, then write via the service role.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body?.unit_id || !body?.description) {
      return NextResponse.json(
        { error: 'unit_id and description are required' },
        { status: 400 },
      );
    }

    const unit = await getOwnedUnit(supabase, user.id, body.unit_id);
    if (!unit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const admin = getSupabaseAdmin();

    // Idempotent offline replay: return the existing snag for this client id.
    if (body.offline_client_id) {
      const { data: existing } = await admin
        .from('snag_items')
        .select('*')
        .eq('tenant_id', unit.tenant_id)
        .eq('offline_client_id', body.offline_client_id)
        .maybeSingle();
      if (existing) return NextResponse.json({ snag: existing, deduped: true });
    }

    const severity: SnagSeverity = isSnagSeverity(body.severity) ? body.severity : 'minor';
    const photoUrls: string[] = Array.isArray(body.photo_urls) ? body.photo_urls : [];
    const primaryPhoto = photoUrls[0] ?? body.photo_url ?? null;

    const insertRow = {
      tenant_id: unit.tenant_id,
      development_id: unit.development_id,
      unit_id: unit.id,
      title: body.title ?? null,
      description: String(body.description).slice(0, 4000),
      severity,
      trade: body.trade ?? null,
      location: body.location ?? null,
      responsible_contractor_id: body.responsible_contractor_id ?? null,
      created_by_role: body.created_by_role ?? 'site_manager',
      created_by_user_id: user.id,
      reported_by: body.reported_by ?? user.email ?? null,
      source: body.source ?? 'in_app',
      photo_url: primaryPhoto,
      photo_urls: photoUrls.length ? photoUrls : primaryPhoto ? [primaryPhoto] : [],
      sla_due_at: body.sla_due_at ?? null,
      offline_client_id: body.offline_client_id ?? null,
      status: 'open',
    };

    const { data: snag, error } = await admin
      .from('snag_items')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      // 23505 = unique violation: a concurrent offline replay won the race.
      if (error.code === '23505' && body.offline_client_id) {
        const { data: existing } = await admin
          .from('snag_items')
          .select('*')
          .eq('tenant_id', unit.tenant_id)
          .eq('offline_client_id', body.offline_client_id)
          .maybeSingle();
        if (existing) return NextResponse.json({ snag: existing, deduped: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ snag }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
