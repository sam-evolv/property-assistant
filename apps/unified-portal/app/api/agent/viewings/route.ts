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

    let query = supabase
      .from('agent_viewings')
      .select('*')
      .eq('agent_id', profile.id)
      .order('viewing_date', { ascending: true })
      .order('viewing_time', { ascending: true });

    if (from) query = query.gte('viewing_date', from);
    if (to) query = query.lte('viewing_date', to);
    if (status) query = query.eq('status', status);

    const { data: viewings, error } = await query;

    if (error) {
      console.error('[agent/viewings GET] Error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch viewings' }, { status: 500 });
    }

    return NextResponse.json({
      viewings: (viewings || []).map(formatViewing),
    });
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

function formatViewing(v: any) {
  return {
    id: v.id,
    agentId: v.agent_id,
    developmentId: v.development_id,
    unitId: v.unit_id,
    buyerName: v.buyer_name,
    buyerPhone: v.buyer_phone,
    buyerEmail: v.buyer_email,
    schemeName: v.scheme_name,
    unitRef: v.unit_ref,
    viewingDate: v.viewing_date,
    viewingTime: v.viewing_time,
    status: v.status,
    notes: v.notes,
    source: v.source,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}
