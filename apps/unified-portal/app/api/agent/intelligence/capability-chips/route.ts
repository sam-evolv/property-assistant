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

  const chips: string[] = [];

  // --- Sales pipeline: scheme-specific, only when we have real names.
  if (schemeNames.length) {
    chips.push(`What's outstanding on contracts in ${schemeNames[0]}?`);
    chips.push(`Brief me on ${schemeNames[0]}`);
    if (schemeNames.length > 1) {
      chips.push(`Switch to ${schemeNames[1]}`);
      chips.push('Show me everything across all schemes');
    }
  }
  chips.push('Show me overdue chases');
  chips.push('What signed this week?');
  chips.push('Chase aged contracts');

  // --- Lettings: only when real rows exist.
  if (lettingAddresses.length) {
    chips.push(`Log a rental viewing for ${lettingAddresses[0]}`);
  }
  if (tenanciesCount > 0) {
    chips.push('Which tenancies are up for renewal?');
  }
  if (applicantsCount > 0 && lettingAddresses.length) {
    chips.push(`Show me applicants for ${lettingAddresses[0]}`);
  }
  if (rentalViewingsCount > 0) {
    chips.push("What rental viewings do I have this week?");
  }

  // --- Reporting / scheduling / briefings: always safe.
  chips.push('Generate developer weekly report');
  chips.push('Give me a scheme summary');
  chips.push("What's on for me today?");
  chips.push('What viewings do I have this week?');

  // --- Drafts: only surface when the inbox actually has items.
  if (draftsCount > 0) {
    chips.push('Review my drafts');
  }

  chips.push('Invite an applicant');
  chips.push('Draft a buyer follow-up email');
  chips.push('Schedule a viewing for Saturday at 2pm');

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
  if (userId) {
    const { data } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data as any;
  }
  const { data } = await supabase
    .from('agent_profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as any) || null;
}
