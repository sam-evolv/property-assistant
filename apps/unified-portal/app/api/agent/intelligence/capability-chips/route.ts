import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { FALLBACK_CAPABILITY_CHIPS } from '@/lib/agent-intelligence/capability-chips';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session 11 — GET /api/agent/intelligence/capability-chips.
 *
 * Returns an honest, live-data-sourced chip list for the Intelligence
 * landing carousel. Every phrase either references a real scheme the
 * agent is assigned to, a real letting-property address on their books,
 * or is context-free ("Generate developer weekly report"). Nothing
 * references a made-up property / buyer / unit.
 *
 * Chips are omitted when the underlying data doesn't exist:
 *   - no letting properties → no rental-viewing or letting chips
 *   - zero applicants → no "Show me applicants for X" chips
 *   - zero tenancies → no renewal chips
 *   - zero drafts → no "Review my drafts" chip
 *
 * Safe to fail: on any error the response falls back to the static
 * always-context-free set, so the carousel still renders something.
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
  // Pull everything we need in parallel, count-only where possible so
  // we don't drag large payloads back for the chip endpoint.
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
    supabase
      .from('agent_letting_properties')
      .select('id, address')
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

  const lettingAddresses = (lettingsRes.data ?? [])
    .map((p: any) => p.address)
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
  // Always safe, action-only.
  chips.push('Show me overdue chases');
  chips.push('What signed this week?');
  chips.push('Chase aged contracts');

  // --- Lettings: only when real rows exist.
  if (lettingAddresses.length) {
    // "Log a rental viewing for {address}" uses a real property the
    // agent already has on their books.
    chips.push(`Log a rental viewing for ${shortenAddress(lettingAddresses[0])}`);
  }
  if (tenanciesCount > 0) {
    chips.push('Which tenancies are up for renewal?');
  }
  if (applicantsCount > 0 && lettingAddresses.length) {
    chips.push(`Show me applicants for ${shortenAddress(lettingAddresses[0])}`);
  }
  if (rentalViewingsCount > 0) {
    chips.push("What rental viewings do I have this week?");
  }

  // --- Reporting / scheduling / briefings: always safe, action-level.
  chips.push('Generate developer weekly report');
  chips.push('Give me a scheme summary');
  chips.push("What's on for me today?");
  chips.push('What viewings do I have this week?');

  // --- Drafts: only surface when the inbox actually has items.
  if (draftsCount > 0) {
    chips.push('Review my drafts');
  }

  // Always keep a few safe action templates, even for brand-new agents.
  chips.push('Invite an applicant');
  chips.push('Draft a buyer follow-up email');
  chips.push('Schedule a viewing for Saturday at 2pm');

  // Deduplicate while preserving insertion order.
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

/**
 * Trim long addresses so they fit on one chip line. "12 Oakfield Lane,
 * Cork" → "12 Oakfield Lane". Keeps the leading number + first line.
 */
function shortenAddress(address: string): string {
  const first = address.split(',')[0]?.trim() ?? address;
  return first.length > 38 ? `${first.slice(0, 36)}…` : first;
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
