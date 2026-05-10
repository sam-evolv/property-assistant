import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const eventId: unknown = body?.device_calendar_event_id;
    if (typeof eventId !== 'string' || eventId.length === 0) {
      return NextResponse.json({ error: 'device_calendar_event_id required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('viewings')
      .update({ device_calendar_event_id: eventId, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('agent_id', user.id)
      .select('id, device_calendar_event_id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Viewing not found' }, { status: 404 });
    }

    return NextResponse.json({ viewing: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
