import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { FALLBACK_CAPABILITY_CHIPS } from '@/lib/agent-intelligence/capability-chips';
import { formatAgentAddress, truncateForChip } from '@/lib/agent/format-address';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session 11 — GET /api/agent/intelligence/capability-chips.
 *
 * Returns an honest, live-data-sourced chip list for the Intelligence
 * landing carousel. Every phrase either references a real scheme the
 * agent is assigned to, a real letting-property address on their books,
 * or is context-free ("Generate developer weekly report").
 *
 * Session 12 — address composition now goes through the shared
 * `formatAgentAddress` helper so structured
 * `address_line_1 / address_line_2 / city / eircode` fields are used
 * when available. No silent prefix stripping (goodbye "Apt 12 → 12
 * Grand Parade" bug).
 *
 * Chips are omitted when the underlying data doesn't exist:
 *   - no letting properties → no rental-viewing or letting chips
 *   - zero applicants → no "Show me applicants for X" chips
 *   - zero tenancies → no renewal chips
 *   - zero drafts → no "Review my drafts" chip
 */

interface ChipResponse {
  chips: string[];
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const profile = await resolveAgentProfile(supabase, user?.id);
    if (!profile) {
      return NextResponse.json<ChipResponse>({ chips: [...FALLBACK_CAPABILITY_CHIPS] });
    }

    const chips = await composeChips(supabase, profile.id);
    return NextResponse.json<ChipResponse>({ chips });
  } catch {
    return NextResponse.json<ChipResponse>({ chips: [...FALLBACK_CAPABILITY_CHIPS] });
  }
}

async function composeChips(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  agentId: string,
): Promise<string[]> {
  const [
    assignmentsRes,
    lettingsRes,
    tenanciesCountRes,
    applicantsCountRes,
    rentalViewingsCountRes,
    draftsCountRes,
  ] = await Promise.all([
    supabase
      .from('agent_scheme_assignments')
      .select('development_id')
      .eq('agent_id', agentId)
      .eq('is_active', true),
    // Session 12: pull the structured address fields alongside the
    // legacy denormalised `address` column. The formatter picks
    // structured fields when present and falls back verbatim otherwise.
    supabase
      .from('agent_letting_properties')
      .select('id, address, address_line_1, address_line_2, city, eircode')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('agent_tenancies')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'active'),
    supabase
      .from('agent_applicants')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId),
    supabase
      .from('agent_viewings')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .not('letting_property_id', 'is', null),
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

  const lettingProps = (lettingsRes.data ?? []) as Array<{
    id: string;
    address: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    eircode: string | null;
  }>;
  const lettingAddresses = lettingProps
    .map((p) => truncateForChip(formatAgentAddress(p, 'short')))
    .filter(Boolean) as string[];

  const tenanciesCount = tenanciesCountRes.count ?? 0;
  const applicantsCount = applicantsCountRes.count ?? 0;
  const rentalViewingsCount = rentalViewingsCountRes.count ?? 0;
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

  // --- Lettings: only when real rows exist.
  if (lettingAddresses.length) {
    chips.push('Log a rental viewing');
  }
  if (tenanciesCount > 0) {
    chips.push('Renewals due');
  }
  if (applicantsCount > 0 && lettingAddresses.length) {
    chips.push('Letting applicants');
  }
  if (rentalViewingsCount > 0) {
    chips.push('Rental viewings');
  }

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
