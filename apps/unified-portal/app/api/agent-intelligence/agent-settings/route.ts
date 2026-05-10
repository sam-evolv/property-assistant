import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APPLICANT_WRITE_MODES = ['always_confirm', 'propose_undoable'] as const;
const CALENDAR_PROVIDERS = ['device', 'google', 'outlook', 'apple'] as const;

type Mode = (typeof APPLICANT_WRITE_MODES)[number];
type Provider = (typeof CALENDAR_PROVIDERS)[number];

function defaultSettings(agentId: string, tenantId: string) {
  return {
    agent_id: agentId,
    tenant_id: tenantId,
    applicant_write_mode: 'always_confirm' as Mode,
    preferred_calendar_provider: null as Provider | null,
  };
}

async function loadOrCreate(authUserId: string, tenantId: string) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('agent_settings')
    .select('agent_id, tenant_id, applicant_write_mode, preferred_calendar_provider, created_at, updated_at')
    .eq('agent_id', authUserId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await supabase
    .from('agent_settings')
    .insert(defaultSettings(authUserId, tenantId))
    .select('agent_id, tenant_id, applicant_write_mode, preferred_calendar_provider, created_at, updated_at')
    .single();
  return created;
}

async function getAuthedAgent() {
  const cookieStore = cookies();
  const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return null;
  const supabase = getSupabaseAdmin();
  const v2 = await resolveAgentContextV2(supabase, user.id);
  if (!v2.context) return null;
  return { authUserId: v2.context.authUserId, tenantId: v2.context.tenantId ?? '' };
}

export async function GET() {
  try {
    const authed = await getAuthedAgent();
    if (!authed) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!authed.tenantId) return NextResponse.json({ error: 'Agent has no tenant assignment' }, { status: 403 });

    const settings = await loadOrCreate(authed.authUserId, authed.tenantId);
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authed = await getAuthedAgent();
    if (!authed) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!authed.tenantId) return NextResponse.json({ error: 'Agent has no tenant assignment' }, { status: 403 });

    const body = await request.json();
    const updates: { applicant_write_mode?: Mode; preferred_calendar_provider?: Provider | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body?.applicant_write_mode === 'string') {
      if (!APPLICANT_WRITE_MODES.includes(body.applicant_write_mode)) {
        return NextResponse.json({ error: 'Invalid applicant_write_mode' }, { status: 400 });
      }
      updates.applicant_write_mode = body.applicant_write_mode;
    }
    if (body?.preferred_calendar_provider === null) {
      updates.preferred_calendar_provider = null;
    } else if (typeof body?.preferred_calendar_provider === 'string') {
      if (!CALENDAR_PROVIDERS.includes(body.preferred_calendar_provider)) {
        return NextResponse.json({ error: 'Invalid preferred_calendar_provider' }, { status: 400 });
      }
      updates.preferred_calendar_provider = body.preferred_calendar_provider;
    }

    // Make sure the row exists before update.
    await loadOrCreate(authed.authUserId, authed.tenantId);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('agent_settings')
      .update(updates)
      .eq('agent_id', authed.authUserId)
      .select('agent_id, tenant_id, applicant_write_mode, preferred_calendar_provider, created_at, updated_at')
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Update failed' }, { status: 500 });
    }
    return NextResponse.json({ settings: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
