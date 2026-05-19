/**
 * Workspace isolation guard for pending_drafts.
 *
 * Regression: Bridge Property Group's Lettings inbox displayed Sales offer
 * drafts (Unit 51 Ardan View, €515k, recipient ailbhe.tierney+u45@example.com)
 * because the drafts query partitioned by draft_type and SHARED draft types
 * (buyer_followup) surfaced in both workspace inboxes.
 *
 * Invariants these tests enforce:
 *   1. assertDraftWorkspace throws when a row's workspace_id doesn't match
 *      the resolved session workspace — this is the server-side tripwire
 *      in the drafts list endpoint.
 *   2. persistSkillEnvelope sets workspace_id on every inserted row from
 *      the active session's mode, never inferring from the originating
 *      record after the fact.
 *   3. resolveWriteWorkspace refuses to fall back to a different mode's
 *      workspace — writing a lettings draft into the sales workspace is
 *      exactly the bleed we're fixing.
 *
 * Hermetic — stubbed Supabase, no network.
 */

import {
  assertDraftWorkspace,
  resolveSessionWorkspace,
  resolveWriteWorkspace,
} from '../../lib/agent-intelligence/workspace-resolution';
import { persistDraftsForEnvelope } from '../../lib/agent-intelligence/draft-store';
import type { AgenticSkillEnvelope } from '../../lib/agent-intelligence/envelope';

type Row = Record<string, any>;

function mockSupabase(state: {
  agent_profiles?: Row[];
  agent_workspaces?: Row[];
  pending_drafts?: Row[];
}) {
  const data = {
    agent_profiles: state.agent_profiles ?? [],
    agent_workspaces: state.agent_workspaces ?? [],
    pending_drafts: state.pending_drafts ?? [],
  };

  function qb(table: keyof typeof data) {
    const filters: Row = {};
    const builder: any = {
      eq(col: string, val: any) { filters[col] = val; return builder; },
      in(col: string, vals: any[]) { filters[`__in_${col}`] = vals; return builder; },
      order() { return builder; },
      limit() { return builder; },
      select() { return builder; },
      insert(row: Row | Row[]) {
        const rows = Array.isArray(row) ? row : [row];
        const inserted = rows.map((r, i) => {
          const withId = { id: r.id || `row-${data[table].length + 1 + i}`, ...r };
          data[table].push(withId);
          return withId;
        });
        return {
          select() {
            return {
              single: async () => ({ data: inserted[0], error: null }),
              then(resolve: any) { return Promise.resolve({ data: inserted, error: null }).then(resolve); },
            };
          },
        };
      },
      async single() {
        const rows = data[table] as Row[];
        const match = rows.find((r) => match_filters(r, filters)) ?? null;
        return { data: match, error: null };
      },
      async maybeSingle() {
        const rows = data[table] as Row[];
        const match = rows.find((r) => match_filters(r, filters)) ?? null;
        return { data: match, error: null };
      },
      then(resolve: any) {
        const rows = (data[table] as Row[]).filter((r) => match_filters(r, filters));
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return builder;
  }

  function match_filters(r: Row, filters: Row): boolean {
    return Object.entries(filters).every(([k, v]) =>
      k.startsWith('__in_') ? (v as any[]).includes(r[k.slice(5)]) : r[k] === v,
    );
  }

  return { from: (table: string) => qb(table as any), _data: data } as any;
}

const TENANT_ID = 'tenant-bridge';
const AGENT_ID = 'profile-bridge';
const USER_ID = 'user-bridge';
const SALES_WORKSPACE = 'ws-sales';
const LETTINGS_WORKSPACE = 'ws-lettings';

function bridgeState() {
  return {
    agent_profiles: [
      { id: AGENT_ID, user_id: USER_ID, tenant_id: TENANT_ID, last_active_workspace_id: SALES_WORKSPACE },
    ],
    agent_workspaces: [
      { id: SALES_WORKSPACE, agent_id: AGENT_ID, tenant_id: TENANT_ID, mode: 'sales', is_default: true },
      { id: LETTINGS_WORKSPACE, agent_id: AGENT_ID, tenant_id: TENANT_ID, mode: 'lettings', is_default: false },
    ],
  };
}

describe('assertDraftWorkspace (read-path tripwire)', () => {
  it('passes silently when every row matches the session workspace', () => {
    expect(() =>
      assertDraftWorkspace(
        [
          { id: 'd1', workspace_id: SALES_WORKSPACE },
          { id: 'd2', workspace_id: SALES_WORKSPACE },
        ],
        SALES_WORKSPACE,
      ),
    ).not.toThrow();
  });

  it('throws when ANY row leaks a different workspace_id', () => {
    expect(() =>
      assertDraftWorkspace(
        [
          { id: 'd1', workspace_id: SALES_WORKSPACE },
          { id: 'd2-leaked', workspace_id: LETTINGS_WORKSPACE },
        ],
        SALES_WORKSPACE,
      ),
    ).toThrow(/Tripwire.*d2-leaked.*Cross-workspace leak/);
  });

  it('throws when workspace_id is NULL (pre-backfill rows must never leak)', () => {
    expect(() =>
      assertDraftWorkspace(
        [{ id: 'd-null', workspace_id: null }],
        SALES_WORKSPACE,
      ),
    ).toThrow(/Tripwire.*d-null/);
  });
});

describe('resolveSessionWorkspace (mode hint vs persisted active)', () => {
  it('uses the explicit mode hint when given, ignoring the persisted active workspace', async () => {
    const supabase = mockSupabase(bridgeState());
    const session = await resolveSessionWorkspace(supabase, USER_ID, 'lettings');
    expect(session?.mode).toBe('lettings');
    expect(session?.workspaceId).toBe(LETTINGS_WORKSPACE);
  });

  it('falls back to the persisted active workspace when no mode hint is supplied', async () => {
    const supabase = mockSupabase(bridgeState());
    const session = await resolveSessionWorkspace(supabase, USER_ID, null);
    expect(session?.mode).toBe('sales');
    expect(session?.workspaceId).toBe(SALES_WORKSPACE);
  });

  it('returns null for an unknown user (no profile)', async () => {
    const supabase = mockSupabase(bridgeState());
    const session = await resolveSessionWorkspace(supabase, 'unknown-user', null);
    expect(session).toBeNull();
  });
});

describe('resolveWriteWorkspace (write-path scope)', () => {
  it('returns the matching workspace_id for the requested mode', async () => {
    const supabase = mockSupabase(bridgeState());
    const wsId = await resolveWriteWorkspace(supabase, USER_ID, 'lettings');
    expect(wsId).toBe(LETTINGS_WORKSPACE);
  });

  it('refuses to fall back when the requested mode does not exist for this user', async () => {
    const stateNoLettings = {
      agent_profiles: bridgeState().agent_profiles,
      agent_workspaces: [
        { id: SALES_WORKSPACE, agent_id: AGENT_ID, tenant_id: TENANT_ID, mode: 'sales', is_default: true },
      ],
    };
    const supabase = mockSupabase(stateNoLettings);
    await expect(resolveWriteWorkspace(supabase, USER_ID, 'lettings')).rejects.toThrow(
      /no workspace with mode=lettings/,
    );
  });
});

describe('persistSkillEnvelope (write-path workspace stamping)', () => {
  it('stamps workspace_id on every inserted row from the agentContext mode', async () => {
    const supabase = mockSupabase(bridgeState());
    const envelope: AgenticSkillEnvelope = {
      skill: 'draft_message',
      summary: 'Drafted one email.',
      coverage: 'ok',
      drafts: [
        {
          id: 'tmp-1',
          type: 'email',
          subject: 'Test',
          body: 'Body',
          recipient: { name: 'Test', email: 'test@example.com', role: 'buyer' },
          affected_record: { id: 'unit-1', kind: 'sales_unit', label: 'Unit 1' },
          reasoning: 'because',
        } as any,
      ],
      meta: {},
    };
    await persistDraftsForEnvelope(supabase, envelope, {
      userId: USER_ID,
      tenantId: TENANT_ID,
      skill: 'draft_message',
      workspaceId: LETTINGS_WORKSPACE,
    });
    const inserted = supabase._data.pending_drafts as Row[];
    expect(inserted.length).toBe(1);
    expect(inserted[0].workspace_id).toBe(LETTINGS_WORKSPACE);
  });
});
