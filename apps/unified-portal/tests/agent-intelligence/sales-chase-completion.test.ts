/**
 * Follow-up regression guards from PR #96's live test (preview cbd7149).
 *
 * Three issues:
 *   A. Two-step chain reliability — model called get_candidate_units but
 *      stopped before draft_buyer_followups when the user asked for both.
 *      Tests assert the SALES system prompt includes the explicit chain
 *      instruction, and that getCandidateUnitsSkill summary appends a
 *      Next: nudge naming the second step.
 *   B. needs_recipient was rendered as a red error. Server now emits a
 *      distinct payload (recipientQuery field, no "we couldn't complete
 *      this" copy when the resolver query is the only signal). Demo-mode
 *      bypass: when isDemoMode=true, surface_aged_contracts_for_solicitor produces drafts
 *      with a placeholder solicitor email instead of the needs_recipient
 *      envelope.
 *   C. Chase body had "where things stand" twice when the model's topic
 *      already covered the ask. Test asserts buildFollowupContent's
 *      conditional tail kicks in — exactly one "where things stand"
 *      beat in the body.
 *
 * Hermetic — stubbed Supabase, no network.
 */

import {
  surfaceAgedContractsForSolicitor,
  draftBuyerFollowups,
  getCandidateUnitsSkill,
} from '../../lib/agent-intelligence/tools/agentic-skills';
import { buildAgentSystemPrompt } from '../../lib/agent-intelligence/system-prompt';

const SKILL_CTX = {
  agentProfileId: 'profile-1' as any,
  authUserId: 'user-1' as any,
  displayName: 'Orla Hennessy',
  agencyName: 'Hennessy Property',
};

type Row = Record<string, any>;

function mockSupabase(state: {
  developments?: Row[];
  units?: Row[];
  agent_scheme_assignments?: Row[];
  unit_sales_pipeline?: Row[];
}) {
  const data: Record<string, Row[]> = {
    developments: state.developments ?? [],
    units: state.units ?? [],
    agent_scheme_assignments: state.agent_scheme_assignments ?? [],
    unit_sales_pipeline: state.unit_sales_pipeline ?? [],
  };

  function qb(table: string) {
    const predicates: Array<(r: Row) => boolean> = [];
    let orderKey: string | null = null;
    let orderAsc = true;
    let limitVal: number | null = null;

    const builder: any = {
      select() { return builder; },
      eq(col: string, val: any) {
        predicates.push((r) => r[col] === val);
        return builder;
      },
      in(col: string, vals: any[]) {
        const set = new Set(vals);
        predicates.push((r) => set.has(r[col]));
        return builder;
      },
      not(col: string, _op: string, val: any) {
        if (val === null) predicates.push((r) => r[col] != null);
        else predicates.push((r) => r[col] !== val);
        return builder;
      },
      is(col: string, val: any) {
        predicates.push((r) => r[col] === val);
        return builder;
      },
      lt(col: string, val: any) {
        predicates.push((r) => r[col] != null && r[col] < val);
        return builder;
      },
      gte(col: string, val: any) {
        predicates.push((r) => r[col] != null && r[col] >= val);
        return builder;
      },
      lte(col: string, val: any) {
        predicates.push((r) => r[col] != null && r[col] <= val);
        return builder;
      },
      ilike() { return builder; },
      or() { return builder; },
      order(col: string, opts?: { ascending?: boolean }) {
        orderKey = col;
        orderAsc = opts?.ascending !== false;
        return builder;
      },
      limit(n: number) { limitVal = n; return builder; },
      async single() {
        const rows = resolve();
        return { data: rows[0] ?? null, error: rows.length ? null : new Error('no rows') };
      },
      async maybeSingle() {
        const rows = resolve();
        return { data: rows[0] ?? null, error: null };
      },
      then(onResolve: any) {
        return Promise.resolve({ data: resolve(), error: null }).then(onResolve);
      },
    };

    function resolve(): Row[] {
      let rows = data[table].filter((r) => predicates.every((p) => p(r)));
      if (orderKey) {
        const key = orderKey;
        rows = rows.slice().sort((a, b) => {
          const av = a[key], bv = b[key];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av < bv ? -1 : 1) * (orderAsc ? 1 : -1);
        });
      }
      if (limitVal != null) rows = rows.slice(0, limitVal);
      return rows;
    }

    return builder;
  }

  return { from: (table: string) => qb(table) } as any;
}

// =====================================================================
// Issue A — Two-step chain reliability
// =====================================================================

describe('Issue A1 — SALES system prompt has the show-and-draft chain example', () => {
  function buildPrompt(): string {
    return buildAgentSystemPrompt(
      {
        agentProfileId: 'profile-1' as any,
        authUserId: 'user-1' as any,
        tenantId: 'tenant-1',
        displayName: 'Orla Hennessy',
        agencyName: 'Hennessy Property',
        agentType: 'sales',
        assignedSchemes: [],
        assignedDevelopmentIds: [],
        assignedDevelopmentNames: [],
        mode: 'sales',
      },
      '',
      '',
      '',
      '',
    );
  }

  it('includes the TWO-STEP CHAIN heading', () => {
    expect(buildPrompt()).toMatch(/TWO-STEP CHAIN/);
  });

  it('explicitly tells the model not to stop after step 1', () => {
    const prompt = buildPrompt();
    expect(prompt).toMatch(/never stop at step 1|Step 1 alone is incomplete|Do not stop after this candidate list/i);
  });

  it('shows the chain firing for "show me whose mortgage is expiring AND draft chase emails"', () => {
    const prompt = buildPrompt();
    expect(prompt).toMatch(/get_candidate_units\(intent='\[matching intent\]'/);
    expect(prompt).toMatch(/draft_buyer_followups\(\s*\n\s*targets=\[unit_ids returned in step 1\]/);
  });
});

describe('Issue A2 — getCandidateUnits envelope summary nudges the second step', () => {
  // mortgage_expiring isn't in main yet (lands with PR #96), so seed the
  // overdue_contracts cohort instead — the nudge logic is intent-agnostic.
  const cutoff = (offsetDays: number): string =>
    new Date(Date.now() + offsetDays * 86400000).toISOString().split('T')[0];

  const state = {
    developments: [{ id: 'dev-1', name: 'Lakeside Manor' }],
    units: [
      { id: 'u-12', development_id: 'dev-1', unit_number: '12', purchaser_name: 'Rónán McCarthy', unit_status: 'contracts_issued' },
    ],
    agent_scheme_assignments: [
      { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
    ],
    unit_sales_pipeline: [
      {
        unit_id: 'u-12',
        development_id: 'dev-1',
        contracts_issued_date: cutoff(-50),
        signed_contracts_date: null,
        purchaser_name: 'Rónán McCarthy',
      },
    ],
  };

  it('summary names draft_buyer_followups as the next call when candidates returned', async () => {
    const supabase = mockSupabase(state);
    const env = await getCandidateUnitsSkill(supabase, SKILL_CTX as any, {
      intent: 'overdue_contracts',
      scheme_name: 'Lakeside Manor',
    });
    expect(env.summary).toMatch(/Next:/);
    expect(env.summary).toMatch(/draft_buyer_followups/);
    expect(env.summary).toMatch(/purpose='chase'/);
    expect(env.summary).toMatch(/SAME turn|do not stop|input to step 2/i);
  });

  it('no nudge when zero candidates — nothing to chain to', async () => {
    const supabase = mockSupabase({
      developments: [{ id: 'dev-1', name: 'Lakeside Manor' }],
      units: [],
      agent_scheme_assignments: [
        { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
      ],
      unit_sales_pipeline: [],
    });
    const env = await getCandidateUnitsSkill(supabase, SKILL_CTX as any, {
      intent: 'overdue_contracts',
    });
    expect(env.summary).not.toMatch(/Next:/);
    expect(env.summary).toMatch(/No candidate units/);
  });
});

// =====================================================================
// Issue B — needs_recipient + demo-mode bypass
// =====================================================================

describe('Issue B (demo bypass) — surface_aged_contracts_for_solicitor produces drafts under isDemoMode', () => {
  const cutoff = (offsetDays: number): string =>
    new Date(Date.now() + offsetDays * 86400000).toISOString();

  const state = {
    developments: [{ id: 'dev-1', name: 'Lakeside Manor' }],
    units: [
      { id: 'u-12', development_id: 'dev-1', unit_number: '12', unit_uid: 'LM-12', purchaser_name: 'Rónán McCarthy' },
      { id: 'u-15', development_id: 'dev-1', unit_number: '15', unit_uid: 'LM-15', purchaser_name: 'Aoife Byrne' },
    ],
    agent_scheme_assignments: [
      { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
    ],
    unit_sales_pipeline: [
      { unit_id: 'u-12', development_id: 'dev-1', contracts_issued_date: cutoff(-60), signed_contracts_date: null, purchaser_name: 'Rónán McCarthy' },
      { unit_id: 'u-15', development_id: 'dev-1', contracts_issued_date: cutoff(-50), signed_contracts_date: null, purchaser_name: 'Aoife Byrne' },
    ],
  };

  it('demo mode → produces one draft per aged contract with a non-blocked placeholder', async () => {
    const supabase = mockSupabase(state);
    const env = await surfaceAgedContractsForSolicitor(
      supabase,
      { ...SKILL_CTX, isDemoMode: true } as any,
      {},
    );
    expect(env.drafts.length).toBe(2);
    for (const d of env.drafts) {
      expect(d.recipient?.role).toBe('solicitor');
      // The demo placeholder must NOT be the production-blocked literal
      // ('solicitor@tbc.invalid' is in BLOCKED_PLACEHOLDER_EMAILS).
      expect(d.recipient?.email).not.toBe('solicitor@tbc.invalid');
      expect(d.recipient?.email).toMatch(/example\.invalid$/);
      expect(d.body).toMatch(/contracts? .*issued/i);
      expect(d.reasoning).toMatch(/DEMO/);
    }
    expect(env.summary).toMatch(/Demo mode/i);
    // No needs_recipient envelope in demo mode.
    expect((env.meta as any).needs_recipient).toBeUndefined();
  });

  it('production mode (isDemoMode false / undefined) → returns needs_recipient envelope, zero drafts', async () => {
    const supabase = mockSupabase(state);
    const env = await surfaceAgedContractsForSolicitor(supabase, SKILL_CTX as any, {});
    expect(env.drafts.length).toBe(0);
    expect((env.meta as any).needs_recipient).toBeDefined();
    expect((env.meta as any).needs_recipient.recipient_query).toBe(
      'solicitor for aged contracts',
    );
    // Summary copy is no longer "we couldn't complete this" — it's a
    // request for more info.
    expect(env.summary).not.toMatch(/can't draft/i);
    expect(env.summary).toMatch(/I need a solicitor email/i);
  });
});

// =====================================================================
// Issue C — Conditional chase body
// =====================================================================

describe('Issue C — chase body avoids the where-things-stand duplicate', () => {
  const cutoff = (offsetDays: number): string =>
    new Date(Date.now() + offsetDays * 86400000).toISOString().split('T')[0];

  const state = {
    developments: [{ id: 'dev-1', name: 'Lakeside Manor' }],
    units: [
      {
        id: 'u-12',
        development_id: 'dev-1',
        unit_number: '12',
        unit_uid: 'LM-12',
        purchaser_name: 'Rónán Curtis',
        purchaser_email: 'ronan@example.com',
        unit_status: 'contracts_issued',
      },
    ],
    agent_scheme_assignments: [
      { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
    ],
    unit_sales_pipeline: [
      {
        unit_id: 'u-12',
        development_id: 'dev-1',
        handover_date: null,
        contracts_issued_date: cutoff(-50),
        signed_contracts_date: null,
        counter_signed_date: null,
        purchaser_name: 'Rónán Curtis',
        purchaser_email: 'ronan@example.com',
      },
    ],
  };

  function countMatches(s: string, re: RegExp): number {
    return (s.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
  }

  it('topic with "where things stand" → standard tail is replaced (exactly one occurrence in body)', async () => {
    const supabase = mockSupabase(state);
    const env = await draftBuyerFollowups(supabase, SKILL_CTX as any, {
      targets: [{ unit_identifier: '12', scheme_name: 'Lakeside Manor' }],
      topic:
        'I noticed your contracts haven\'t been signed yet — could you let me know where things stand?',
      purpose: 'chase',
    });
    expect(env.drafts).toHaveLength(1);
    const body = env.drafts[0].body;
    expect(countMatches(body, /where things stand/i)).toBe(1);
    // The complementary tail still asks for a response.
    expect(body).toMatch(/work through anything that's holding things up/i);
  });

  it('topic without "where things stand" → standard tail is preserved', async () => {
    const supabase = mockSupabase(state);
    const env = await draftBuyerFollowups(supabase, SKILL_CTX as any, {
      targets: [{ unit_identifier: '12', scheme_name: 'Lakeside Manor' }],
      topic:
        'Wanted to flag that the kitchen selection deadline has been pushed to next Friday.',
      purpose: 'chase',
    });
    expect(env.drafts).toHaveLength(1);
    const body = env.drafts[0].body;
    // Original chase tail copy still appears.
    expect(body).toMatch(/Could you let me know where things stand on your end\?/);
  });
});
