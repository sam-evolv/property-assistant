import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for resolving an agent's scope from an auth user id.
 *
 * Every agentic skill and the chat route go through this helper so they
 * share exactly one path from `auth.uid()` → `agent_profiles.id` →
 * `agent_scheme_assignments.development_id[]`. If any tool takes a shortcut
 * (e.g. `.eq('agent_id', auth.uid())`) it goes silent on real data because
 * assignments are keyed by `agent_profiles.id`, never the auth uuid.
 *
 * Uses the service-role client (RLS off) intentionally — the agent_id on
 * `agent_scheme_assignments` already guarantees tenant scope via the
 * `agent_profiles.tenant_id` chain, so filtering by tenant_id on the
 * assignment row is redundant and, in practice, exclusionary when the
 * tenant_id column is null on legacy rows.
 */

export interface ResolvedAgentContext {
  authUserId: string;
  agentProfileId: string;
  tenantId: string | null;
  displayName: string;
  agentType: string | null;
  agencyName: string | null;
  assignedDevelopmentIds: string[];
  assignedDevelopmentNames: string[];
  assignedSchemes: Array<{
    developmentId: string;
    schemeName: string;
    unitCount: number;
    location: string | null;
    developerName: string | null;
  }>;
}

interface ResolveOptions {
  activeDevelopmentId?: string | null;
}

/**
 * Resolve a full agent context (profile + assignments + unit counts) from a
 * Supabase auth user id.
 *
 * Returns `null` when no agent profile exists for the given auth user and no
 * fallback was available.
 */
export async function resolveAgentContext(
  supabase: SupabaseClient,
  authUserId: string | null | undefined,
  opts: ResolveOptions = {},
): Promise<ResolvedAgentContext | null> {
  // Session 15 — generalize-agent. Removed the `fetchEarliestProfile`
  // fallback that previously kicked in when no auth user resolved a
  // profile. That fallback silently returned the first row in
  // `agent_profiles` ordered by created_at — which, with Orla being the
  // first seeded agent, meant any unauthenticated request silently
  // received Orla's full agent context (assignments, schemes, units).
  // That's a per-user data-isolation bug. The correct behaviour is to
  // return `null` and let the caller render an unauthenticated/empty
  // state, never another agent's data.
  const profile = authUserId ? await fetchProfileByUserId(supabase, authUserId) : null;

  if (!profile) return null;

  const [assignmentsResult, tenantResult] = await Promise.all([
    fetchAssignments(supabase, profile.id),
    profile.tenant_id ? fetchTenantName(supabase, profile.tenant_id) : Promise.resolve(null),
  ]);

  const developmentIds = Array.from(
    new Set(assignmentsResult.map((a) => a.development_id).filter(Boolean) as string[]),
  );

  let assignedSchemes: ResolvedAgentContext['assignedSchemes'] = [];
  if (developmentIds.length) {
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name, county')
      .in('id', developmentIds);

    const unitCounts = await fetchUnitCounts(supabase, developmentIds, profile.tenant_id ?? null);

    assignedSchemes = (devs ?? []).map((d: any) => ({
      developmentId: d.id,
      schemeName: d.name,
      unitCount: unitCounts.get(d.id) ?? 0,
      location: d.county ?? null,
      developerName: tenantResult,
    }));
  }

  // If an `activeDevelopmentId` was supplied (UI scheme picker) and the
  // assignment query came back empty, fall back to showing just that
  // development so the model can still see *something* rather than
  // "(none assigned)". Do not include it as an assigned scheme for
  // permission purposes — only for display.
  if (!assignedSchemes.length && opts.activeDevelopmentId) {
    const { data: dev } = await supabase
      .from('developments')
      .select('id, name, county')
      .eq('id', opts.activeDevelopmentId)
      .maybeSingle();
    if (dev) {
      const unitCounts = await fetchUnitCounts(supabase, [dev.id], profile.tenant_id ?? null);
      assignedSchemes = [
        {
          developmentId: dev.id,
          schemeName: dev.name,
          unitCount: unitCounts.get(dev.id) ?? 0,
          location: dev.county ?? null,
          developerName: tenantResult,
        },
      ];
    }
  }

  return {
    authUserId: authUserId || profile.user_id || profile.id,
    agentProfileId: profile.id,
    tenantId: profile.tenant_id ?? null,
    displayName: profile.display_name || 'Agent',
    agentType: profile.agent_type ?? null,
    agencyName: profile.agency_name ?? null,
    assignedDevelopmentIds: assignedSchemes.map((s) => s.developmentId),
    assignedDevelopmentNames: assignedSchemes.map((s) => s.schemeName),
    assignedSchemes,
  };
}

async function fetchProfileByUserId(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, user_id, tenant_id, display_name, agent_type, agency_name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as AgentProfileRow | null;
}

// Session 15 — `fetchEarliestProfile` was removed. It used to be the
// fallback for unresolved auth users, but it returned the first
// row in `agent_profiles` (Orla, in production), silently leaking her
// data to any session that lost its auth user. Do not re-add it.

async function fetchAssignments(supabase: SupabaseClient, agentProfileId: string) {
  // Intentionally no tenant_id filter: the join through agent_profiles already
  // establishes tenant scope. Filtering here drops rows whose tenant_id
  // column is null on legacy data.
  //
  // Session 14.2 — capture and log errors instead of swallowing them.
  // Pre-14.2 this function did `const { data } = …; return data ?? []`,
  // which turned a transient Supabase error (network hiccup, cold
  // start, revoked service-role key) into a silent empty assignment
  // list. Downstream code (scheme-resolver, read-tools) then told the
  // user "you have no schemes assigned" — the exact Session 6A
  // regression. Now: if the call errors, log loudly AND throw, so the
  // caller surfaces a 500 the operator will actually see instead of a
  // silent "(none)".
  //
  // Session 14.4 — RLS-vs-service-role probe. If the SELECT returns zero
  // rows, run a `head: true, count: 'exact'` probe against the same
  // filter and compare. Equal counts → genuine empty data. Probe
  // returns more rows → we're being filtered by RLS, which means the
  // calling client is running as `anon` or `authenticated` even though
  // we believe it's service-role. That's the smoking gun for a
  // misconfigured SUPABASE_SERVICE_ROLE_KEY env var (or a stale value
  // that doesn't decode to role=service_role). Either way, we throw a
  // diagnostic error rather than letting the chat reply with the
  // verifiable lie "you have no schemes assigned".
  const { data, error } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id, is_active, role')
    .eq('agent_id', agentProfileId)
    .eq('is_active', true);
  if (error) {
    console.error('[agent-context] fetchAssignments error', {
      agentProfileId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(`fetchAssignments failed for agent ${agentProfileId}: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ development_id: string; is_active: boolean; role: string | null }>;

  if (rows.length === 0) {
    // Defensive probe: re-run the same filter using head+count. If the
    // probe also returns zero, the agent genuinely has no active
    // assignments (legitimate empty state — log once, return empty).
    // If the probe returns >0, RLS is hiding rows from the SELECT path,
    // which only happens when the supabase client isn't operating as
    // service_role. Throw with a precise message naming the env var.
    try {
      const probe = await supabase
        .from('agent_scheme_assignments')
        .select('development_id', { count: 'exact', head: true })
        .eq('agent_id', agentProfileId)
        .eq('is_active', true);
      const probeCount = probe.count ?? null;
      if (probeCount !== null && probeCount > 0) {
        // Bug confirmed: rows exist server-side but the SELECT returned
        // none. That's an RLS / service-role mismatch.
        const msg = `[agent-context] fetchAssignments returned 0 rows but a head+count probe found ${probeCount}. ` +
          `This is the "Assigned: (none)" failure mode. Root cause is almost always SUPABASE_SERVICE_ROLE_KEY ` +
          `missing or stale on this Vercel environment scope (Preview vs Production). Verify the env var, ` +
          `redeploy, and re-run.`;
        console.error(msg, {
          agentProfileId,
          selectCount: 0,
          probeCount,
          urlHost: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0],
          serviceKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        });
        throw new Error(msg);
      }
      // probeCount === 0 (or null) — genuine empty state, fall through.
      console.error('[agent-context] fetchAssignments: 0 active assignments for this profile', {
        agentProfileId,
        probeCount,
      });
    } catch (err: any) {
      // Re-throw our own diagnostic; for any other probe error log and
      // continue — we don't want a probe failure to be worse than the
      // empty-result we'd have returned anyway.
      if (typeof err?.message === 'string' && err.message.includes('"Assigned: (none)" failure mode')) {
        throw err;
      }
      console.error('[agent-context] fetchAssignments probe failed (continuing with empty result):', err?.message || err);
    }
  }

  return rows;
}

async function fetchTenantName(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
  const { data } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();
  return data?.name ?? null;
}

async function fetchUnitCounts(
  supabase: SupabaseClient,
  developmentIds: string[],
  tenantId: string | null,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!developmentIds.length) return counts;

  await Promise.all(
    developmentIds.map(async (devId) => {
      let q = supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('development_id', devId);
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { count } = await q;
      counts.set(devId, count ?? 0);
    }),
  );

  return counts;
}

interface AgentProfileRow {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  display_name: string | null;
  agent_type: string | null;
  agency_name: string | null;
}

/**
 * Match a user-supplied scheme name (fuzzy, case-insensitive) against the
 * agent's assigned development list. Returns the development id when it is in
 * scope, or `null` when the scheme is not assigned to this agent.
 *
 * Use this at tool entry to confirm a requested scheme is within the agent's
 * scope before running any query.
 */
export function matchAssignedScheme(
  ctx: Pick<ResolvedAgentContext, 'assignedDevelopmentIds' | 'assignedDevelopmentNames'>,
  requestedName: string,
): { developmentId: string; schemeName: string } | null {
  const needle = requestedName.trim().toLowerCase();
  if (!needle) return null;
  for (let i = 0; i < ctx.assignedDevelopmentNames.length; i++) {
    const name = ctx.assignedDevelopmentNames[i];
    if (!name) continue;
    const hay = name.toLowerCase();
    if (hay === needle || hay.includes(needle) || needle.includes(hay)) {
      return { developmentId: ctx.assignedDevelopmentIds[i], schemeName: name };
    }
  }
  return null;
}
