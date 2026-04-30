import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { FALLBACK_CAPABILITY_CHIPS } from '@/lib/agent-intelligence/capability-chips';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/intelligence/capability-chips.
 *
 * Returns an honest, live-data-sourced chip list for the Intelligence
 * landing carousel. The route branches on `?mode=` — `lettings` runs
 * `composeLettingsChips` (real tenancies + vacancies + lettings phrases),
 * anything else runs `composeChips` (sales-only chips: schemes, chase,
 * weekly report, drafts).
 *
 * Lettings-flavoured chips ("Renewals due", "Log a rental viewing",
 * "Letting applicants", "Rental viewings") live exclusively in
 * composeLettingsChips. Mixing them into the sales composer leaks BTR
 * vocabulary into Sales workspaces.
 */

interface ChipResponse {
  chips: string[];
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const profile = await resolveAgentProfile(supabase, user?.id);
    if (!profile) {
      return NextResponse.json<ChipResponse>({ chips: [...FALLBACK_CAPABILITY_CHIPS] });
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') === 'lettings' ? 'lettings' : 'sales';

    const chips = mode === 'lettings'
      ? await composeLettingsChips(supabase, profile.id)
      : await composeChips(supabase, profile.id);
    return NextResponse.json<ChipResponse>({ chips });
  } catch {
    return NextResponse.json<ChipResponse>({ chips: [...FALLBACK_CAPABILITY_CHIPS] });
  }
}

// Lettings-mode chip composer. Sources a dynamic chip from the nearest
// expiring active tenancy and another from a real vacant property, plus
// four evergreen action phrases. Falls back to safe lettings phrases if
// the dynamic queries return nothing.
async function composeLettingsChips(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  agentId: string,
): Promise<string[]> {
  const today = new Date();
  const fourteenDaysOut = new Date(today.getTime() + 14 * 86_400_000);

  const [tenanciesRes, vacantRes] = await Promise.all([
    supabase
      .from('agent_tenancies')
      .select('id, tenant_name, lease_end, letting_property_id')
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .not('lease_end', 'is', null)
      .gte('lease_end', today.toISOString().split('T')[0])
      .lte('lease_end', fourteenDaysOut.toISOString().split('T')[0])
      .order('lease_end', { ascending: true })
      .limit(1),
    supabase
      .from('agent_letting_properties')
      .select('id, address_line_1, address')
      .eq('agent_id', agentId)
      .in('status', ['vacant', 'available', 'empty'])
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const chips: string[] = [];

  // Dynamic chip 1: nearest expiring tenancy ("Aisling: lease in 2d")
  const tenancy = (tenanciesRes.data ?? [])[0] as
    | { id: string; tenant_name: string | null; lease_end: string | null; letting_property_id: string | null }
    | undefined;
  if (tenancy?.tenant_name && tenancy.lease_end) {
    const firstName = tenancy.tenant_name.split(/[ &]/)[0];
    const days = Math.ceil((new Date(tenancy.lease_end).getTime() - today.getTime()) / 86_400_000);
    if (firstName && days >= 0 && days <= 14) {
      chips.push(`${firstName}: lease in ${days}d`);
    }
  }

  // Dynamic chip 2: a real vacant property ("Re-let 1 Rose Hill")
  const vacant = (vacantRes.data ?? [])[0] as
    | { id: string; address_line_1: string | null; address: string | null }
    | undefined;
  if (vacant) {
    const addr = vacant.address_line_1 || (vacant.address || '').split(',')[0];
    if (addr) {
      const truncated = addr.length > 14 ? addr.slice(0, 14) : addr;
      chips.push(`Re-let ${truncated}`);
    }
  }

  // Evergreen action chips — always present, lettings-flavoured.
  chips.push('Renewals due');
  chips.push('Rent reminders');
  chips.push('Compliance gaps');
  chips.push('Vacancies summary');

  // Pad with safe lettings fallbacks if dynamic queries returned nothing.
  if (chips.length < 4) {
    for (const fb of [
      'Draft a rent reminder',
      "This week’s viewings",
      'Tenant queries',
      'Maintenance tickets',
    ]) {
      if (!chips.includes(fb)) chips.push(fb);
      if (chips.length >= 8) break;
    }
  }

  // Dedupe + cap (the carousel rotates 4 visible at a time).
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const c of chips) {
    if (!seen.has(c)) {
      seen.add(c);
      deduped.push(c);
    }
  }
  return deduped;
}

async function composeChips(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  agentId: string,
): Promise<string[]> {
  const [
    assignmentsRes,
    draftsCountRes,
  ] = await Promise.all([
    supabase
      .from('agent_scheme_assignments')
      .select('development_id')
      .eq('agent_id', agentId)
      .eq('is_active', true),
    supabase
      .from('pending_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', agentId)
      .eq('skin', 'agent')
      .eq('status', 'pending_review'),
  ]);

  const developmentIds = Array.from(
    new Set(
      (assignmentsRes.data ?? []).map((a: any) => a.development_id).filter(Boolean),
    ),
  );
  let schemeNames: string[] = [];
  if (developmentIds.length) {
    const { data: devs } = await supabase
      .from('developments')
      .select('name')
      .in('id', developmentIds);
    schemeNames = (devs ?? []).map((d: any) => d.name).filter(Boolean);
  }

  const draftsCount = draftsCountRes.count ?? 0;

  // Session 14.12 — chip copy is short, action-oriented, and never
  // truncated in the carousel. Each phrase is ≤22 chars where possible.
  // Scheme-specific phrases use the shortest scheme name (token 1) when
  // including a name in the copy would otherwise blow the budget.
  const chips: string[] = [];

  const shortest = (names: string[]): string => {
    const ranked = [...names].sort((a, b) => a.length - b.length);
    return ranked[0] || '';
  };
  const firstScheme = shortest(schemeNames);

  // --- Sales pipeline: scheme-specific, only when we have real names.
  if (firstScheme && firstScheme.length <= 14) {
    chips.push(`Brief on ${firstScheme}`);
  } else if (schemeNames.length) {
    chips.push('Brief on a scheme');
  }
  chips.push('Chase aged contracts');
  chips.push('Show overdue chases');
  chips.push('Signed this week?');

  // --- Reporting / scheduling / briefings: always safe.
  chips.push('Weekly report');
  chips.push('Scheme summary');
  chips.push("What's on today?");
  chips.push('This week’s viewings');

  // --- Drafts: only surface when the inbox actually has items.
  if (draftsCount > 0) {
    chips.push('Review my drafts');
  }

  chips.push('Invite an applicant');
  chips.push('Draft a follow-up');
  chips.push('Schedule a viewing');

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const c of chips) {
    if (!seen.has(c)) {
      seen.add(c);
      deduped.push(c);
    }
  }
  return deduped;
}

async function resolveAgentProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string | undefined,
): Promise<{ id: string } | null> {
  // Session 15 — generalize-agent. Removed the "earliest profile"
  // fallback. Without an authenticated user we now return null, which
  // causes the route handler to send back the static
  // `FALLBACK_CAPABILITY_CHIPS`. Previously this fell back to the first
  // agent in the table (Orla, in production), which silently leaked her
  // chip set — including scheme names and address fragments composed
  // by `composeChips` — to unauthenticated visitors.
  if (!userId) return null;
  const { data } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}
