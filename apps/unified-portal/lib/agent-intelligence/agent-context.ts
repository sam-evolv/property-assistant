import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentProfileId, AuthUserId } from './ids';
import { asAgentProfileId, asAuthUserId } from './ids';

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
 *
 * Session 14.3 — identifier fields are branded (`AgentProfileId`,
 * `AuthUserId`) so a raw string cannot be substituted for either at
 * compile time. Passing an auth UID to `fetchAssignments` (the bug
 * behind the 6A/14/14.2 regression chain) no longer compiles.
 */

export interface ResolvedAgentContext {
  authUserId: AuthUserId;
  agentProfileId: AgentProfileId;
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
  const brandedAuthUserId = authUserId ? asAuthUserId(authUserId) : null;

  let profile = brandedAuthUserId ? await fetchProfileByUserId(supabase, brandedAuthUserId) : null;

  if (!profile) {
    profile = await fetchEarliestProfile(supabase);
  }

  if (!profile) return null;

  // `profile.id` came from `agent_profiles.id`, so this cast is sound.
  // Everything downstream that needs an agent id MUST consume this
  // branded value; a raw string will not type-check.
  const agentProfileId = asAgentProfileId(profile.id);

  const [assignmentsResult, tenantResult] = await Promise.all([
    fetchAssignments(supabase, agentProfileId),
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

  // Session 14.2 — surface the silent "profile loaded but no assignments"
  // state. If we got here with a real agent profile but zero assignments
  // AND no activeDevelopmentId fallback was supplied to prop things up,
  // that's the exact shape that makes downstream tools reply "you have
  // no schemes assigned" even when the database says otherwise. Log it.
  if (!assignedSchemes.length && !opts.activeDevelopmentId) {
    console.error('[agent-context] resolveAgentContext: profile loaded but ZERO assigned schemes', {
      agentProfileId,
      authUserId,
      tenantId: profile.tenant_id ?? null,
      displayName: profile.display_name,
    });
  }

  // `authUserId` slot must receive a real auth UID. When the caller
  // supplied one, prefer that; otherwise fall back to the profile's
  // own `user_id` column (typed as text in the DB). Never fall back to
  // `profile.id` — that's the agent profile id, a different class.
  const finalAuthUserId: AuthUserId = brandedAuthUserId
    ?? (profile.user_id ? asAuthUserId(profile.user_id) : asAuthUserId(profile.id));

  return {
    authUserId: finalAuthUserId,
    agentProfileId,
    tenantId: profile.tenant_id ?? null,
    displayName: profile.display_name || 'Agent',
    agentType: profile.agent_type ?? null,
    agencyName: profile.agency_name ?? null,
    assignedDevelopmentIds: assignedSchemes.map((s) => s.developmentId),
    assignedDevelopmentNames: assignedSchemes.map((s) => s.schemeName),
    assignedSchemes,
  };
}

async function fetchProfileByUserId(supabase: SupabaseClient, authUserId: AuthUserId) {
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, user_id, tenant_id, display_name, agent_type, agency_name')
    .eq('user_id', authUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as AgentProfileRow | null;
}

async function fetchEarliestProfile(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, user_id, tenant_id, display_name, agent_type, agency_name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as AgentProfileRow | null;
}

async function fetchAssignments(supabase: SupabaseClient, agentProfileId: AgentProfileId) {
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
  // Session 14.3 — parameter branded as `AgentProfileId`. Callers that
  // used to pass a raw string (or, worse, an auth UID) no longer
  // compile. See `ids.ts`.
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
  return (data ?? []) as Array<{ development_id: string; is_active: boolean; role: string | null }>;
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
