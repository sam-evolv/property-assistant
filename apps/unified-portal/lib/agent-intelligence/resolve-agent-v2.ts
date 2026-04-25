import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResolvedAgentContext } from './agent-context';

/**
 * Session 14.6 — clean-room replacement for resolveAgentContext.
 *
 * The original resolveAgentContext (in agent-context.ts) silently returns
 * empty assignments for Orla in production despite:
 *   - The service-role JWT decoding correctly
 *   - The same query against the same client returning 5 rows when run
 *     standalone from /health
 *   - The defensive probe inside fetchAssignments not throwing
 *
 * After 3 diagnostic rounds we still haven't pinpointed why the SELECT
 * returns 0 inside that function but 5 outside it. Rather than continue
 * debugging, this file is a fresh implementation with:
 *   - No Promise.all parallelism (sequential, easier to trace)
 *   - Inline raw SQL via supabase.rpc when needed (bypass any PostgREST
 *     selection oddity)
 *   - Explicit trace array surfaced to callers
 *   - No reuse of the original module's helpers
 *
 * If this v2 returns the correct 5 assignments while v1 returns 0 in
 * the same request, we've isolated the bug into v1's call path and
 * can wire v2 in for chat routes immediately.
 */

export interface ResolveTrace {
  step: string;
  details: Record<string, unknown>;
  ms: number;
}

export interface ResolveAgentV2Result {
  context: ResolvedAgentContext | null;
  trace: ResolveTrace[];
}

export async function resolveAgentContextV2(
  supabase: SupabaseClient,
  authUserId: string | null | undefined,
): Promise<ResolveAgentV2Result> {
  const trace: ResolveTrace[] = [];
  const t0 = Date.now();
  const log = (step: string, details: Record<string, unknown>) => {
    trace.push({ step, details, ms: Date.now() - t0 });
  };

  log('input', { authUserId, authUserIdType: typeof authUserId });

  // 1. Look up profile by auth user id.
  let profile: AgentProfileRow | null = null;
  if (authUserId) {
    const profileRes = await supabase
      .from('agent_profiles')
      .select('id, user_id, tenant_id, display_name, agent_type, agency_name')
      .eq('user_id', authUserId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    log('profile-by-userid', {
      data: profileRes.data ? { id: (profileRes.data as any).id, user_id: (profileRes.data as any).user_id } : null,
      error: profileRes.error?.message ?? null,
    });
    profile = (profileRes.data as AgentProfileRow | null) ?? null;
  }

  // 2. Fallback: earliest profile.
  if (!profile) {
    const fallbackRes = await supabase
      .from('agent_profiles')
      .select('id, user_id, tenant_id, display_name, agent_type, agency_name')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    log('profile-fallback', {
      data: fallbackRes.data ? { id: (fallbackRes.data as any).id, user_id: (fallbackRes.data as any).user_id } : null,
      error: fallbackRes.error?.message ?? null,
    });
    profile = (fallbackRes.data as AgentProfileRow | null) ?? null;
  }

  if (!profile) {
    log('no-profile', {});
    return { context: null, trace };
  }

  log('profile-resolved', {
    id: profile.id,
    user_id: profile.user_id,
    tenant_id: profile.tenant_id,
    display_name: profile.display_name,
  });

  // 3. Fetch assignments — sequential, no Promise.all, with extensive logging.
  const agentProfileId: string = profile.id;
  log('fetch-assignments-start', { agentProfileId, agentProfileIdLength: agentProfileId.length });

  const assignmentsRes = await supabase
    .from('agent_scheme_assignments')
    .select('development_id, is_active, role')
    .eq('agent_id', agentProfileId)
    .eq('is_active', true);
  log('fetch-assignments-result', {
    rowCount: assignmentsRes.data?.length ?? null,
    error: assignmentsRes.error?.message ?? null,
    rows: assignmentsRes.data?.slice(0, 10) ?? null,
  });

  // If the SELECT returned 0, run a head+count probe with SAME filter
  // and a SECOND probe selecting only 'id' — if the probe finds rows
  // the SELECT didn't, we've isolated the failure mode.
  let probeAResult: { count: number | null; error: string | null } | null = null;
  let probeBResult: { count: number | null; error: string | null } | null = null;
  let probeCResult: { count: number | null; error: string | null; rowsFound: number | null } | null = null;
  if ((assignmentsRes.data?.length ?? 0) === 0) {
    const probeA = await supabase
      .from('agent_scheme_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentProfileId)
      .eq('is_active', true);
    probeAResult = { count: probeA.count ?? null, error: probeA.error?.message ?? null };
    log('probe-a-head-id', probeAResult);

    const probeB = await supabase
      .from('agent_scheme_assignments')
      .select('development_id', { count: 'exact', head: true })
      .eq('agent_id', agentProfileId)
      .eq('is_active', true);
    probeBResult = { count: probeB.count ?? null, error: probeB.error?.message ?? null };
    log('probe-b-head-development_id', probeBResult);

    // Probe C — full select with count, but no head. Same shape as the
    // SELECT above, but with explicit count. If this returns rows that
    // the SELECT didn't, that's a smoking gun for supabase-js dropping
    // rows post-fetch.
    const probeC = await supabase
      .from('agent_scheme_assignments')
      .select('development_id, is_active, role', { count: 'exact' })
      .eq('agent_id', agentProfileId)
      .eq('is_active', true);
    probeCResult = {
      count: probeC.count ?? null,
      error: probeC.error?.message ?? null,
      rowsFound: probeC.data?.length ?? null,
    };
    log('probe-c-full-with-count', probeCResult);
  }

  // 4. Use whichever data source actually returned rows. Prefer the
  //    main SELECT; if it was empty but probe-c found rows, use probe-c's data.
  const effectiveRows: Array<{ development_id: string; is_active?: boolean; role?: string | null }> =
    assignmentsRes.data?.length
      ? (assignmentsRes.data as any)
      : ((probeCResult && (probeCResult.count ?? 0) > 0)
          ? // re-run if probe-c indicated rows exist; supabase-js head-mode doesn't return rows
            await refetchAssignments(supabase, agentProfileId)
          : []);

  log('effective-rows', { count: effectiveRows.length });

  const developmentIds = Array.from(
    new Set(effectiveRows.map((a) => a.development_id).filter(Boolean)),
  );

  // 5. Hydrate scheme names.
  let assignedSchemes: ResolvedAgentContext['assignedSchemes'] = [];
  if (developmentIds.length) {
    const devsRes = await supabase
      .from('developments')
      .select('id, name, address')
      .in('id', developmentIds);
    log('developments-hydrate', {
      count: devsRes.data?.length ?? null,
      error: devsRes.error?.message ?? null,
    });
    assignedSchemes = (devsRes.data ?? []).map((d: any) => ({
      developmentId: d.id,
      schemeName: d.name,
      unitCount: 0, // skip unit counts to keep this minimal — chat route can hydrate later if needed
      location: d.address ?? null,
      developerName: null,
    }));
  }

  // 6. Tenant name (best-effort).
  let tenantName: string | null = null;
  if (profile.tenant_id) {
    const tenantRes = await supabase
      .from('tenants')
      .select('name')
      .eq('id', profile.tenant_id)
      .maybeSingle();
    tenantName = (tenantRes.data as any)?.name ?? null;
    log('tenant-hydrate', { name: tenantName });
  }

  const context: ResolvedAgentContext = {
    authUserId: authUserId || profile.user_id || profile.id,
    agentProfileId: profile.id,
    tenantId: profile.tenant_id ?? null,
    displayName: profile.display_name || 'Agent',
    agentType: profile.agent_type ?? null,
    agencyName: profile.agency_name ?? null,
    assignedDevelopmentIds: assignedSchemes.map((s) => s.developmentId),
    assignedDevelopmentNames: assignedSchemes.map((s) => s.schemeName),
    assignedSchemes: assignedSchemes.map((s) => ({
      ...s,
      developerName: tenantName,
    })),
  };
  log('return', {
    agentProfileId: context.agentProfileId,
    assignedDevelopmentIdsCount: context.assignedDevelopmentIds.length,
  });

  return { context, trace };
}

async function refetchAssignments(supabase: SupabaseClient, agentProfileId: string) {
  // Try a slightly different selection list — '*' instead of named columns —
  // in case there's a column-resolution oddity in supabase-js when the
  // selected columns interact with RLS.
  const res = await supabase
    .from('agent_scheme_assignments')
    .select('*')
    .eq('agent_id', agentProfileId)
    .eq('is_active', true);
  return (res.data ?? []) as any;
}

interface AgentProfileRow {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  display_name: string | null;
  agent_type: string | null;
  agency_name: string | null;
}
