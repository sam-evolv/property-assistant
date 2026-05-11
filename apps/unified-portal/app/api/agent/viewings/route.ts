import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/viewings
 * Returns all viewings for the authenticated agent.
 * Optional query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=confirmed
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedAgent();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const status = searchParams.get('status');

    // Get agent profile
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'No agent profile found' }, { status: 404 });
    }

    // Read from BOTH tables. The agent-intelligence write path inserts into
    // `viewings` (canonical schema with applicant_id / development_id /
    // scheduled_at). The legacy manual form inserts into `agent_viewings`
    // (denormalised columns). Until the manual form is migrated we have to
    // surface both so nothing scheduled by either path goes invisible.
    let legacyQuery = supabase
      .from('agent_viewings')
      .select('*')
      .eq('agent_id', profile.id)
      .order('viewing_date', { ascending: true })
      .order('viewing_time', { ascending: true });
    if (from) legacyQuery = legacyQuery.gte('viewing_date', from);
    if (to) legacyQuery = legacyQuery.lte('viewing_date', to);
    if (status) legacyQuery = legacyQuery.eq('status', status);

    let canonicalQuery = supabase
      .from('viewings')
      .select('id, agent_id, applicant_id, development_id, unit_id, scheduled_at, duration_minutes, location, status, notes, created_at, updated_at')
      .eq('tenant_id', profile.tenant_id)
      .order('scheduled_at', { ascending: true });
    if (from) canonicalQuery = canonicalQuery.gte('scheduled_at', `${from}T00:00:00Z`);
    if (to) canonicalQuery = canonicalQuery.lte('scheduled_at', `${to}T23:59:59Z`);

    const [legacyRes, canonicalRes] = await Promise.all([legacyQuery, canonicalQuery]);

    if (legacyRes.error) {
      console.error('[agent/viewings GET] legacy error:', legacyRes.error.message);
    }
    if (canonicalRes.error) {
      console.error('[agent/viewings GET] canonical error:', canonicalRes.error.message);
    }

    const canonicalRows = canonicalRes.data || [];
    const applicantIds = Array.from(new Set(canonicalRows.map((r: any) => r.applicant_id).filter(Boolean)));
    const developmentIds = Array.from(new Set(canonicalRows.map((r: any) => r.development_id).filter(Boolean)));

    const [applicantsRes, developmentsRes] = await Promise.all([
      applicantIds.length
        ? supabase.from('agent_applicants').select('id, full_name').in('id', applicantIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }>, error: null }),
      developmentIds.length
        ? supabase.from('developments').select('id, name').in('id', developmentIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    ]);

    const applicantNameById = new Map<string, string>(
      (applicantsRes.data || []).map((a: any) => [a.id, a.full_name]),
    );
    const developmentNameById = new Map<string, string>(
      (developmentsRes.data || []).map((d: any) => [d.id, d.name]),
    );

    const canonicalFormatted = canonicalRows
      .map((r: any) => formatCanonicalViewing(r, applicantNameById, developmentNameById))
      .filter((v) => !status || v.status === status);

    const legacyFormatted = (legacyRes.data || []).map(formatViewing);

    // Merge and dedupe. Canonical wins on id collision (defensive — these
    // tables share no FK so collisions are extremely unlikely, but a row
    // could exist in both if a manual form write later seeded a real
    // viewings row by another path).
    const seen = new Set<string>();
    const merged: Viewing[] = [];
    for (const v of [...canonicalFormatted, ...legacyFormatted]) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      merged.push(v);
    }

    console.log('[agent/viewings GET]', {
      agentProfileId: profile.id,
      tenantId: profile.tenant_id,
      canonicalCount: canonicalFormatted.length,
      legacyCount: legacyFormatted.length,
      mergedCount: merged.length,
    });

    return NextResponse.json({ viewings: merged });
  } catch (error: any) {
    console.error('[agent/viewings GET] Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch viewings' }, { status: 500 });
  }
}

/**
 * POST /api/agent/viewings
 * Create a new viewing.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedAgent();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Get agent profile
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'No agent profile found' }, { status: 404 });
    }

    const { data: viewing, error } = await supabase
      .from('agent_viewings')
      .insert({
        agent_id: profile.id,
        tenant_id: profile.tenant_id,
        development_id: body.developmentId || null,
        unit_id: body.unitId || null,
        buyer_name: body.buyerName,
        buyer_phone: body.buyerPhone || null,
        buyer_email: body.buyerEmail || null,
        scheme_name: body.schemeName || null,
        unit_ref: body.unitRef || null,
        viewing_date: body.viewingDate,
        viewing_time: body.viewingTime,
        status: body.status || 'confirmed',
        notes: body.notes || null,
        source: body.source || 'manual',
      })
      .select()
      .single();

    if (error) {
      console.error('[agent/viewings POST] Error:', error.message);
      return NextResponse.json({ error: 'Failed to create viewing' }, { status: 500 });
    }

    return NextResponse.json({ viewing: formatViewing(viewing) }, { status: 201 });
  } catch (error: any) {
    console.error('[agent/viewings POST] Error:', error.message);
    return NextResponse.json({ error: 'Failed to create viewing' }, { status: 500 });
  }
}

/**
 * PATCH /api/agent/viewings?id=<viewing_id>
 * Update a viewing (status, notes, time, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedAgent();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const viewingId = searchParams.get('id');
    if (!viewingId) {
      return NextResponse.json({ error: 'Missing viewing id' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.status) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.viewingDate) updates.viewing_date = body.viewingDate;
    if (body.viewingTime) updates.viewing_time = body.viewingTime;
    if (body.buyerName) updates.buyer_name = body.buyerName;
    if (body.schemeName) updates.scheme_name = body.schemeName;
    if (body.unitRef) updates.unit_ref = body.unitRef;

    const { data: viewing, error } = await supabase
      .from('agent_viewings')
      .update(updates)
      .eq('id', viewingId)
      .select()
      .single();

    if (error) {
      console.error('[agent/viewings PATCH] Error:', error.message);
      return NextResponse.json({ error: 'Failed to update viewing' }, { status: 500 });
    }

    return NextResponse.json({ viewing: formatViewing(viewing) });
  } catch (error: any) {
    console.error('[agent/viewings PATCH] Error:', error.message);
    return NextResponse.json({ error: 'Failed to update viewing' }, { status: 500 });
  }
}

/**
 * DELETE /api/agent/viewings?id=<viewing_id>
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedAgent();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const viewingId = searchParams.get('id');
    if (!viewingId) {
      return NextResponse.json({ error: 'Missing viewing id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('agent_viewings')
      .delete()
      .eq('id', viewingId);

    if (error) {
      console.error('[agent/viewings DELETE] Error:', error.message);
      return NextResponse.json({ error: 'Failed to delete viewing' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[agent/viewings DELETE] Error:', error.message);
    return NextResponse.json({ error: 'Failed to delete viewing' }, { status: 500 });
  }
}

/* ─── Helpers ─── */

interface Viewing {
  id: string;
  agentId: string | null;
  developmentId: string | null;
  unitId: string | null;
  buyerName: string;
  buyerPhone: string | null;
  buyerEmail: string | null;
  schemeName: string | null;
  unitRef: string | null;
  viewingDate: string;
  viewingTime: string;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// Map canonical `viewings` rows into the legacy Viewing shape the page
// expects. The agent-intelligence path stores scheduled_at as a timestamptz,
// applicant_id / development_id as FKs, and status='scheduled'. Convert that
// into date/time strings, denormalised buyer/scheme names, and a status the
// StatusBadge knows about ('scheduled' -> 'confirmed').
function formatCanonicalViewing(
  row: any,
  applicantNames: Map<string, string>,
  developmentNames: Map<string, string>,
): Viewing {
  const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : null;
  const isoParts = scheduled
    ? (() => {
        const fmt = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Dublin',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const parts: Record<string, string> = {};
        for (const p of fmt.formatToParts(scheduled)) {
          if (p.type !== 'literal') parts[p.type] = p.value;
        }
        return {
          date: `${parts.year}-${parts.month}-${parts.day}`,
          time: `${parts.hour}:${parts.minute}`,
        };
      })()
    : { date: '', time: '' };

  const rawStatus = (row.status as string) || 'scheduled';
  const status = rawStatus === 'scheduled' ? 'confirmed' : rawStatus;

  return {
    id: row.id,
    agentId: row.agent_id ?? null,
    developmentId: row.development_id ?? null,
    unitId: row.unit_id ?? null,
    buyerName: applicantNames.get(row.applicant_id) || 'Applicant',
    buyerPhone: null,
    buyerEmail: null,
    schemeName: developmentNames.get(row.development_id) || null,
    unitRef: null,
    viewingDate: isoParts.date,
    viewingTime: isoParts.time,
    status,
    notes: row.notes ?? null,
    source: 'intelligence',
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

async function getAuthenticatedAgent() {
  const supabaseAuth = createServerComponentClient({ cookies });
  const { data: { user }, error } = await supabaseAuth.auth.getUser();

  if (error || !user) {
    return { user: null, supabase: null as any };
  }

  // Use service role for data operations to bypass RLS issues
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  return { user, supabase };
}

function formatViewing(v: any): Viewing {
  return {
    id: v.id,
    agentId: v.agent_id ?? null,
    developmentId: v.development_id ?? null,
    unitId: v.unit_id ?? null,
    buyerName: v.buyer_name ?? 'Applicant',
    buyerPhone: v.buyer_phone ?? null,
    buyerEmail: v.buyer_email ?? null,
    schemeName: v.scheme_name ?? null,
    unitRef: v.unit_ref ?? null,
    viewingDate: v.viewing_date ?? '',
    viewingTime: v.viewing_time ?? '',
    status: v.status,
    notes: v.notes ?? null,
    source: v.source ?? null,
    createdAt: v.created_at ?? null,
    updatedAt: v.updated_at ?? null,
  };
}
