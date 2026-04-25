/**
 * Session 6A regression guard.
 *
 * Protects the `auth.uid()` → `agent_profiles.id` → `agent_scheme_assignments`
 * chain from sliding back into the shortcut that caused Orla Hennessy's
 * "no schemes assigned" hallucination. These are unit-level tests driven
 * against a stub Supabase client so they are hermetic (no network, no CI
 * credentials), yet they exercise the real query shape.
 */

import { resolveAgentContext, matchAssignedScheme } from '../../lib/agent-intelligence/agent-context';
import { getSchemeSummary } from '../../lib/agent-intelligence/tools/read-tools';
import { buildAgentSystemPrompt } from '../../lib/agent-intelligence/system-prompt';
import type { AgentContext } from '../../lib/agent-intelligence/types';

const ORLA_AUTH_UID = 'cfaae4e0-894a-43cf-af9b-a74e9ce0532d';
const ORLA_PROFILE_ID = '0f9210e0-342d-4f98-9be1-95decb6f507a';
const ARDAN_VIEW_ID = '34316432-0000-0000-0000-000000000001';
const ARDAN_VIEW_NAME = 'Árdan View';
const TENANT_ID = 'tenant-11111111-1111-1111-1111-111111111111';

type Row = Record<string, any>;

interface MockState {
  agent_profiles: Row[];
  agent_scheme_assignments: Row[];
  developments: Row[];
  units: Row[];
  tenants: Row[];
  unit_sales_pipeline: Row[];
  calls: Array<{ table: string; action: string; filters: Record<string, any> }>;
}

function createMockSupabase(state: MockState): any {
  function queryBuilder(table: string, selection: string, countMode?: 'exact') {
    const filters: Record<string, any> = {};
    const inFilters: Record<string, any[]> = {};
    let isHead = false;

    const exec = async () => {
      let rows = [...(state as any)[table]] as Row[];
      for (const [col, val] of Object.entries(filters)) {
        rows = rows.filter((r) => r[col] === val);
      }
      for (const [col, vals] of Object.entries(inFilters)) {
        rows = rows.filter((r) => vals.includes(r[col]));
      }
      state.calls.push({ table, action: 'select', filters: { ...filters, ...inFilters } });
      const count = rows.length;
      if (isHead) return { data: null, count, error: null };
      return { data: rows, count: countMode ? count : undefined, error: null };
    };

    const builder: any = {
      eq(col: string, val: any) { filters[col] = val; return builder; },
      in(col: string, vals: any[]) { inFilters[col] = vals; return builder; },
      ilike(col: string, _pattern: string) { return builder; },
      order() { return builder; },
      limit() { return builder; },
      neq() { return builder; },
      gte() { return builder; },
      lte() { return builder; },
      lt() { return builder; },
      not() { return builder; },
      is() { return builder; },
      or() { return builder; },
      async single() { const r = await exec(); return { data: (r.data as Row[])[0] ?? null, error: r.error }; },
      async maybeSingle() { const r = await exec(); return { data: (r.data as Row[])[0] ?? null, error: r.error }; },
      then(resolve: any, reject: any) { return exec().then(resolve, reject); },
    };

    const origSelect = builder;
    // The .select('id', { count, head }) call overload — return self so the
    // caller chains filters, then exec applies the count/head at resolution.
    origSelect.select = (_s: string, opts?: { count?: 'exact'; head?: boolean }) => {
      if (opts?.head) isHead = true;
      return builder;
    };

    return builder;
  }

  return {
    from(table: string) {
      return {
        select(_selection: string, opts?: { count?: 'exact'; head?: boolean }) {
          const qb = queryBuilder(table, _selection, opts?.count);
          if (opts?.head) qb.select('', { head: true });
          return qb;
        },
      };
    },
  };
}

function baseState(): MockState {
  return {
    agent_profiles: [
      {
        id: ORLA_PROFILE_ID,
        user_id: ORLA_AUTH_UID,
        tenant_id: TENANT_ID,
        display_name: 'Orla Hennessy',
        agent_type: 'scheme',
        agency_name: 'Hennessy Property',
        created_at: '2025-01-01T00:00:00Z',
      },
    ],
    agent_scheme_assignments: [
      {
        id: 'asg-1',
        agent_id: ORLA_PROFILE_ID,
        development_id: ARDAN_VIEW_ID,
        // Intentionally null — this is the production shape that caused the
        // original bug. The resolver must still pick this row up.
        tenant_id: null,
        is_active: true,
        role: 'lead_agent',
      },
    ],
    developments: [
      { id: ARDAN_VIEW_ID, name: ARDAN_VIEW_NAME, county: 'Cork', tenant_id: TENANT_ID },
    ],
    units: Array.from({ length: 86 }, (_, i) => ({
      id: `unit-${i + 1}`,
      development_id: ARDAN_VIEW_ID,
      tenant_id: TENANT_ID,
    })),
    tenants: [{ id: TENANT_ID, name: 'Ardan Developments Ltd' }],
    unit_sales_pipeline: [],
    calls: [],
  };
}

describe('resolveAgentContext', () => {
  it('resolves Orla via auth.uid() → agent_profiles.id and picks up her Árdan View assignment', async () => {
    const state = baseState();
    const supabase = createMockSupabase(state);

    const resolved = await resolveAgentContext(supabase, ORLA_AUTH_UID);

    expect(resolved).not.toBeNull();
    expect(resolved!.agentProfileId).toBe(ORLA_PROFILE_ID);
    expect(resolved!.authUserId).toBe(ORLA_AUTH_UID);
    expect(resolved!.displayName).toBe('Orla Hennessy');
    expect(resolved!.assignedDevelopmentIds).toEqual([ARDAN_VIEW_ID]);
    expect(resolved!.assignedDevelopmentNames).toEqual([ARDAN_VIEW_NAME]);
    expect(resolved!.assignedSchemes[0].unitCount).toBe(86);
  });

  it('does not filter agent_scheme_assignments by tenant_id (would silently exclude legacy rows)', async () => {
    const state = baseState();
    const supabase = createMockSupabase(state);

    await resolveAgentContext(supabase, ORLA_AUTH_UID);

    const asgCall = state.calls.find((c) => c.table === 'agent_scheme_assignments');
    expect(asgCall).toBeDefined();
    expect(asgCall!.filters).not.toHaveProperty('tenant_id');
    expect(asgCall!.filters).toHaveProperty('agent_id', ORLA_PROFILE_ID);
    expect(asgCall!.filters).toHaveProperty('is_active', true);
  });

  it('returns null for an unauthenticated request — never falls back to the earliest agent (Session 15)', async () => {
    const state = baseState();
    const supabase = createMockSupabase(state);

    // Pre-Session-15, this would have silently returned Orla's context
    // because the resolver fell back to the earliest profile in the
    // table when no auth user was supplied. Post-fix, an unauthenticated
    // request must yield null so the caller renders an empty/auth-required
    // state instead of leaking another agent's data.
    const resolved = await resolveAgentContext(supabase, undefined);
    expect(resolved).toBeNull();

    const resolvedNull = await resolveAgentContext(supabase, null);
    expect(resolvedNull).toBeNull();
  });

  it('returns null when the auth user has no agent_profile row — no fallback to another agent (Session 15)', async () => {
    const state = baseState();
    const supabase = createMockSupabase(state);

    // Auth user exists but is not an agent. Pre-Session-15, this would
    // have returned Orla's context via the earliest-profile fallback.
    const ghostUserId = '00000000-0000-0000-0000-deadbeef0000';
    const resolved = await resolveAgentContext(supabase, ghostUserId);
    expect(resolved).toBeNull();
  });

  it('matchAssignedScheme confirms a scheme is in scope (fuzzy, case-insensitive)', () => {
    const ctx = {
      assignedDevelopmentIds: [ARDAN_VIEW_ID],
      assignedDevelopmentNames: [ARDAN_VIEW_NAME],
    };
    expect(matchAssignedScheme(ctx, 'árdan view')).toEqual({
      developmentId: ARDAN_VIEW_ID,
      schemeName: ARDAN_VIEW_NAME,
    });
    expect(matchAssignedScheme(ctx, 'Ardan')).not.toBeNull();
    expect(matchAssignedScheme(ctx, 'Riverside Gardens')).toBeNull();
  });
});

describe('buildAgentSystemPrompt scope block', () => {
  it('renders Orla\'s assigned developments and active scheme into the prompt', () => {
    const ctx: AgentContext = {
      agentId: ORLA_PROFILE_ID,
      userId: ORLA_AUTH_UID,
      tenantId: TENANT_ID,
      displayName: 'Orla Hennessy',
      agencyName: 'Hennessy Property',
      agentType: 'scheme',
      assignedSchemes: [
        {
          developmentId: ARDAN_VIEW_ID,
          schemeName: ARDAN_VIEW_NAME,
          unitCount: 86,
          location: 'Cork',
          developerName: 'Ardan Developments Ltd',
        },
      ],
      assignedDevelopmentIds: [ARDAN_VIEW_ID],
      assignedDevelopmentNames: [ARDAN_VIEW_NAME],
      activeDevelopmentId: ARDAN_VIEW_ID,
    };

    const prompt = buildAgentSystemPrompt(ctx, '', '', '', '', '', '', '');

    expect(prompt).toContain('Current agent context:');
    expect(prompt).toContain('Name: Orla Hennessy');
    expect(prompt).toContain(`Assigned developments: ${ARDAN_VIEW_NAME}`);
    expect(prompt).toContain(`Active scheme: ${ARDAN_VIEW_NAME}`);
    expect(prompt).not.toMatch(/Assigned developments:\s*\(none\)/);
  });
});

describe('getSchemeSummary', () => {
  it('returns real numbers for Orla\'s Árdan View scope and never says "no schemes assigned"', async () => {
    const state = baseState();
    state.unit_sales_pipeline = [
      { unit_id: 'unit-1', development_id: ARDAN_VIEW_ID, status: 'signed', sale_price: 450000, signed_contracts_date: '2026-01-10' },
      { unit_id: 'unit-2', development_id: ARDAN_VIEW_ID, status: 'sale_agreed', sale_price: 460000, sale_agreed_date: '2026-03-01' },
      {
        unit_id: 'unit-3',
        development_id: ARDAN_VIEW_ID,
        status: 'contracts_issued',
        sale_price: 440000,
        contracts_issued_date: new Date(Date.now() - 35 * 86400000).toISOString(), // 35d ago — overdue per >28d rule
      },
    ];
    const supabase = createMockSupabase(state);

    const ctx: AgentContext = {
      agentId: ORLA_PROFILE_ID,
      userId: ORLA_AUTH_UID,
      tenantId: TENANT_ID,
      displayName: 'Orla Hennessy',
      assignedSchemes: [{
        developmentId: ARDAN_VIEW_ID,
        schemeName: ARDAN_VIEW_NAME,
        unitCount: 86,
      }],
      assignedDevelopmentIds: [ARDAN_VIEW_ID],
      assignedDevelopmentNames: [ARDAN_VIEW_NAME],
      activeDevelopmentId: ARDAN_VIEW_ID,
    };

    const result = await getSchemeSummary(supabase, TENANT_ID, ctx, {});

    expect(result.data).not.toBeNull();
    expect(result.data.total_units).toBe(86);
    expect(result.data.status_breakdown.signed).toBe(1);
    expect(result.data.status_breakdown.sale_agreed).toBe(1);
    expect(result.data.status_breakdown.in_progress).toBe(1);
    expect(result.data.overdue_contracts).toBe(1);
    expect(result.data.next_actions.length).toBeGreaterThan(0);
    expect(result.summary).toContain(ARDAN_VIEW_NAME);
    expect(result.summary).not.toMatch(/no schemes/i);
  });

  it('refuses to summarise a scheme outside the agent\'s assigned list when a name is given', async () => {
    const state = baseState();
    const supabase = createMockSupabase(state);
    const ctx: AgentContext = {
      agentId: ORLA_PROFILE_ID,
      userId: ORLA_AUTH_UID,
      tenantId: TENANT_ID,
      displayName: 'Orla Hennessy',
      assignedSchemes: [{ developmentId: ARDAN_VIEW_ID, schemeName: ARDAN_VIEW_NAME, unitCount: 86 }],
      assignedDevelopmentIds: [ARDAN_VIEW_ID],
      assignedDevelopmentNames: [ARDAN_VIEW_NAME],
      activeDevelopmentId: null,
    };

    const result = await getSchemeSummary(supabase, TENANT_ID, ctx, { scheme_name: 'Riverside Gardens' });

    expect(result.data).toBeNull();
    expect(result.summary).toMatch(/not in your assigned schemes/i);
  });
});
