import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { getOwnedUnit, isSnagSeverity } from '@/lib/dev-app/snags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/dev-app/snags/import
 * The independent purchaser's-snagger ingestion path. Two modes:
 *
 *   { unit_id, snags: [ { description, severity?, trade?, location?, photo_urls? } ] }
 *       -> bulk-insert structured snags now (works today)
 *
 *   { unit_id, file_url }
 *       -> parse a PDF / photo report into structured snags (TODO: AI vision +
 *          LLM extraction, frontier Claude). Returns 501 until wired.
 *
 * Either way snags land on the unit as source='uploaded_report', so the
 * builder's fixes start the same day instead of waiting on a posted PDF — the
 * lag-collapse that makes this a wedge.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body?.unit_id) {
      return NextResponse.json({ error: 'unit_id is required' }, { status: 400 });
    }

    const unit = await getOwnedUnit(supabase, user.id, body.unit_id);
    if (!unit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Mode 2: automated report parsing is a V1.0 follow-up. Return a clear
    // contract so the client can fall back to manual entry meanwhile.
    if (body.file_url && !Array.isArray(body.snags)) {
      return NextResponse.json(
        {
          error: 'not_implemented',
          detail: 'Automated report parsing is coming; post a `snags` array for now.',
        },
        { status: 501 },
      );
    }

    if (!Array.isArray(body.snags) || body.snags.length === 0) {
      return NextResponse.json({ error: 'snags array is required' }, { status: 400 });
    }

    const rows = body.snags.slice(0, 500).map((s: any) => {
      const photoUrls: string[] = Array.isArray(s.photo_urls) ? s.photo_urls : [];
      return {
        tenant_id: unit.tenant_id,
        development_id: unit.development_id,
        unit_id: unit.id,
        title: s.title ?? null,
        description: String(s.description ?? '').slice(0, 4000) || 'Imported snag',
        severity: isSnagSeverity(s.severity) ? s.severity : 'minor',
        trade: s.trade ?? null,
        location: s.location ?? null,
        photo_urls: photoUrls,
        photo_url: photoUrls[0] ?? null,
        created_by_role: body.created_by_role ?? 'purchaser_snagger',
        created_by_user_id: user.id,
        reported_by: body.reported_by ?? null,
        source: 'uploaded_report',
        status: 'open',
      };
    });

    const admin = getSupabaseAdmin();
    const { data: inserted, error } = await admin
      .from('snag_items')
      .insert(rows)
      .select('id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ created: inserted?.length ?? 0 }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
