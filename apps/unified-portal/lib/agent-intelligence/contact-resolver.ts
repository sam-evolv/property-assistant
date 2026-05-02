import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Contact resolution for the email-drafting tools. Replaces the previous
 * fallback that wrote `recipient@tbc.invalid` whenever no email was on
 * file: the agent now sees an inline prompt naming the candidates instead
 * of a placeholder draft that fails at the persistence guard.
 *
 * Sources, in order:
 *   1. Buyers / purchasers attached to the agent's assigned schemes
 *      (units.purchaser_name + purchaser_email, plus the pipeline row).
 *   2. Tenants in the agent's lettings portfolio
 *      (agent_tenancies.tenant_name + tenant_email).
 *   3. Developers attached to the agent's schemes
 *      (developments.developer_user_id → auth.users.email).
 *
 * A query may be a free-text name ("Daniel Whelan") or a role keyword
 * ("the developer", "the dev", "the manager"). Role keywords short-circuit
 * the name-search and resolve via the active scheme(s).
 */

export type ContactRole = 'buyer' | 'tenant' | 'developer' | 'solicitor' | 'unknown';

export interface ResolvedContact {
  name: string;
  email: string;
  role: ContactRole;
  source: string;
  schemeName?: string;
  unitLabel?: string;
}

export type ContactResolution =
  | { status: 'one'; contact: ResolvedContact }
  | { status: 'multiple'; candidates: ResolvedContact[] }
  | { status: 'none'; searched: string[] };

export interface ContactResolverContext {
  agentProfileId: string;
  /**
   * If omitted, the resolver loads them from agent_scheme_assignments.
   */
  assignedDevelopmentIds?: string[];
  activeDevelopmentId?: string | null;
}

async function loadAssignedDevelopmentIds(
  supabase: SupabaseClient,
  agentProfileId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', agentProfileId)
    .eq('is_active', true);
  return Array.from(
    new Set((data || []).map((r: any) => r.development_id).filter(Boolean)),
  );
}

const ROLE_KEYWORDS: Record<string, ContactRole> = {
  'the developer': 'developer',
  'developer': 'developer',
  'the dev': 'developer',
  'dev': 'developer',
  'my developer': 'developer',
  'the builder': 'developer',
  'builder': 'developer',
};

export function detectRoleKeyword(query: string): ContactRole | null {
  const normalised = (query || '').toLowerCase().trim().replace(/^(to|email)\s+/, '');
  if (ROLE_KEYWORDS[normalised]) return ROLE_KEYWORDS[normalised];
  // "the developer of Lakeside Manor" / "the developer for Lakeside" — match
  // the leading words.
  for (const key of Object.keys(ROLE_KEYWORDS)) {
    if (normalised.startsWith(`${key} `)) return ROLE_KEYWORDS[key];
  }
  return null;
}

function dedupeByEmail(list: ResolvedContact[]): ResolvedContact[] {
  const seen = new Map<string, ResolvedContact>();
  for (const c of list) {
    const key = `${(c.email || '').toLowerCase()}|${(c.name || '').toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

function nameTokensMatch(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return false;
  if (h === n || h.includes(n) || n.includes(h)) return true;
  // Token overlap: every token in the shorter side must appear in the other.
  const hTokens = new Set(h.split(/\s+/).filter(Boolean));
  const nTokens = n.split(/\s+/).filter(Boolean);
  if (nTokens.length === 0) return false;
  return nTokens.every((t) => hTokens.has(t));
}

async function resolveBuyersByName(
  supabase: SupabaseClient,
  ctx: { assignedDevelopmentIds: string[] },
  name: string,
): Promise<ResolvedContact[]> {
  if (!ctx.assignedDevelopmentIds.length) return [];
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, unit_uid, development_id, purchaser_name, purchaser_email')
    .in('development_id', ctx.assignedDevelopmentIds);
  const { data: pipeline } = await supabase
    .from('unit_sales_pipeline')
    .select('unit_id, development_id, purchaser_name, purchaser_email')
    .in('development_id', ctx.assignedDevelopmentIds);
  const { data: developments } = await supabase
    .from('developments')
    .select('id, name')
    .in('id', ctx.assignedDevelopmentIds);
  const devNameById = new Map<string, string>(
    (developments || []).map((d: any) => [d.id, d.name]),
  );

  const out: ResolvedContact[] = [];
  for (const u of units || []) {
    const pname: string | null = u.purchaser_name;
    const pemail: string | null = u.purchaser_email;
    if (!pname || !pemail) continue;
    if (!nameTokensMatch(pname, name)) continue;
    const unitLabel = `Unit ${u.unit_number ?? u.unit_uid ?? '?'}`;
    out.push({
      name: pname,
      email: pemail,
      role: 'buyer',
      source: 'units',
      schemeName: devNameById.get(u.development_id) || undefined,
      unitLabel,
    });
  }
  for (const p of pipeline || []) {
    const pname: string | null = p.purchaser_name;
    const pemail: string | null = p.purchaser_email;
    if (!pname || !pemail) continue;
    if (!nameTokensMatch(pname, name)) continue;
    out.push({
      name: pname,
      email: pemail,
      role: 'buyer',
      source: 'unit_sales_pipeline',
      schemeName: devNameById.get(p.development_id) || undefined,
    });
  }
  return out;
}

async function resolveTenantsByName(
  supabase: SupabaseClient,
  ctx: { agentProfileId: string },
  name: string,
): Promise<ResolvedContact[]> {
  const { data, error } = await supabase
    .from('agent_tenancies')
    .select('tenant_name, tenant_email, status, agent_letting_properties!inner(address_line_1, address)')
    .eq('agent_id', ctx.agentProfileId)
    .eq('status', 'active');
  if (error || !data) return [];
  const out: ResolvedContact[] = [];
  for (const t of data as any[]) {
    if (!t.tenant_name || !t.tenant_email) continue;
    if (!nameTokensMatch(t.tenant_name, name)) continue;
    const property = t.agent_letting_properties;
    out.push({
      name: t.tenant_name,
      email: t.tenant_email,
      role: 'tenant',
      source: 'agent_tenancies',
      unitLabel: property?.address_line_1 || property?.address || undefined,
    });
  }
  return out;
}

async function resolveDevelopersForSchemes(
  supabase: SupabaseClient,
  developmentIds: string[],
): Promise<ResolvedContact[]> {
  if (!developmentIds.length) return [];
  const { data: developments } = await supabase
    .from('developments')
    .select('id, name, developer_user_id')
    .in('id', developmentIds);
  const userIds = Array.from(
    new Set(
      (developments || [])
        .map((d: any) => d.developer_user_id)
        .filter((id: string | null) => !!id),
    ),
  );
  if (!userIds.length) return [];

  // Try `admins` first (has email + role); fall back to a profiles view if
  // the deployment exposes one.
  const { data: admins } = await supabase
    .from('admins')
    .select('id, email')
    .in('id', userIds);
  const emailById = new Map<string, string>(
    (admins || []).map((a: any) => [a.id, a.email]),
  );

  // If admins didn't cover every developer_user_id, fall through to a
  // best-effort auth lookup. Wrapped in try/catch because some tenants
  // restrict admin RPC access.
  const missing = userIds.filter((id) => !emailById.has(id));
  for (const userId of missing) {
    try {
      const res = await (supabase as any).auth.admin.getUserById(userId);
      const email: string | undefined = res?.data?.user?.email;
      if (email) emailById.set(userId, email);
    } catch {
      /* swallow — surfaces as "no email on file" downstream */
    }
  }

  const out: ResolvedContact[] = [];
  for (const d of developments || []) {
    const email = emailById.get(d.developer_user_id);
    if (!email) continue;
    out.push({
      name: `Developer (${d.name})`,
      email,
      role: 'developer',
      source: 'developments.developer_user_id',
      schemeName: d.name,
    });
  }
  return out;
}

async function resolveDevelopersByName(
  supabase: SupabaseClient,
  ctx: { assignedDevelopmentIds: string[] },
  name: string,
): Promise<ResolvedContact[]> {
  const all = await resolveDevelopersForSchemes(supabase, ctx.assignedDevelopmentIds);
  // Match by scheme name (most realistic: "the Lakeside developer") or by
  // email local-part when the user types a literal first name.
  return all.filter((c) => {
    if (c.schemeName && nameTokensMatch(c.schemeName, name)) return true;
    const local = (c.email || '').split('@')[0] || '';
    return nameTokensMatch(local.replace(/[._-]/g, ' '), name);
  });
}

/**
 * Public entry point. Resolve a free-text recipient query to one or more
 * concrete contacts the agent can email. Returns a structured result so
 * the caller can render an inline prompt for the disambiguation case.
 */
export async function resolveAgentContact(
  supabase: SupabaseClient,
  ctx: ContactResolverContext,
  query: { name?: string; role?: ContactRole | null; schemeHint?: string | null },
): Promise<ContactResolution> {
  const searched: string[] = [];
  const candidates: ResolvedContact[] = [];

  // Role-keyword short-circuit. If the original query was "the developer",
  // the model should have set role='developer' before calling, but we
  // re-detect from the name string as a belt-and-braces.
  const detectedRole = query.role || detectRoleKeyword(query.name || '');

  const assignedDevelopmentIds = ctx.assignedDevelopmentIds
    ?? (await loadAssignedDevelopmentIds(supabase, ctx.agentProfileId));
  const fullCtx: Required<Pick<ContactResolverContext, 'agentProfileId' | 'assignedDevelopmentIds'>> &
    Pick<ContactResolverContext, 'activeDevelopmentId'> = {
    agentProfileId: ctx.agentProfileId,
    assignedDevelopmentIds,
    activeDevelopmentId: ctx.activeDevelopmentId,
  };

  if (detectedRole === 'developer') {
    searched.push('developers');
    let scope = fullCtx.assignedDevelopmentIds;
    if (query.schemeHint) {
      const lower = query.schemeHint.toLowerCase();
      const { data: devs } = await supabase
        .from('developments')
        .select('id, name')
        .in('id', fullCtx.assignedDevelopmentIds);
      const matches = (devs || []).filter((d: any) =>
        String(d.name).toLowerCase().includes(lower),
      );
      if (matches.length) scope = matches.map((d: any) => d.id);
    } else if (fullCtx.activeDevelopmentId) {
      scope = [fullCtx.activeDevelopmentId];
    }
    const resolved = await resolveDevelopersForSchemes(supabase, scope);
    candidates.push(...resolved);
  } else if (query.name && query.name.trim().length >= 2) {
    const name = query.name.trim();
    searched.push('buyers', 'tenants', 'developers');
    const [buyers, tenants, developers] = await Promise.all([
      resolveBuyersByName(supabase, fullCtx, name).catch(() => []),
      resolveTenantsByName(supabase, fullCtx, name).catch(() => []),
      resolveDevelopersByName(supabase, fullCtx, name).catch(() => []),
    ]);
    candidates.push(...buyers, ...tenants, ...developers);
  }

  const deduped = dedupeByEmail(candidates);
  if (deduped.length === 0) return { status: 'none', searched };
  if (deduped.length === 1) return { status: 'one', contact: deduped[0] };
  return { status: 'multiple', candidates: deduped };
}
