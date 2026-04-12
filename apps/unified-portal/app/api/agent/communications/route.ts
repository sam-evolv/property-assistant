import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'No agent profile' }, { status: 403 });
    }

    const { data: events } = await supabase
      .from('communication_events')
      .select('*')
      .eq('agent_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ events: events ?? [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'No agent profile' }, { status: 403 });
    }

    const body = await request.json();
    const { type, subject, body: messageBody, recipient_name, recipient_email, unit_id, development_id } = body;

    const { data: event, error } = await supabase
      .from('communication_events')
      .insert({
        agent_id: profile.id,
        tenant_id: profile.tenant_id,
        type: type || 'email',
        subject,
        body: messageBody,
        recipient_name,
        recipient_email,
        unit_id,
        development_id,
        status: 'sent',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
