/**
 * Sales chase-email path regression guards.
 *
 * Three production failures (audit 2026-05-06) drove these tests:
 *   1. chase_aged_contracts mis-picked for buyer chases (rename guard via
 *      drafts-pipeline.test.ts already covers the registry side).
 *   2. mortgage_expiry_date had no candidate-unit exposure — the audit
 *      flagged it as a missing intent. Test below drives the new
 *      'mortgage_expiring' branch end-to-end.
 *   3. Verbatim topic-bleed: model passed a fragment ("update on signing
 *      their contracts") and the chase body composer dropped it in
 *      unchanged. Test below asserts the safety-net appends a sentence
 *      terminator so the body never reads as a missing placeholder.
 *
 * Hermetic — stubbed Supabase, no network.
 */

import {
  getCandidateUnits,
  MORTGAGE_EXPIRY_WINDOW_DAYS,
} from '../../lib/agent-intelligence/unit-resolver';
import {
  draftBuyerFollowups,
  ensureSentenceTerminator,
} from '../../lib/agent-intelligence/tools/agentic-skills';

const SKILL_CTX = {
  agentProfileId: 'profile-1' as any,
  authUserId: 'user-1' as any,
  displayName: 'Orla Hennessy',
  agencyName: 'Hennessy Property',
};

type Row = Record<string, any>;

// Mock supabase that supports the operators used by the
// 'mortgage_expiring' branch: gte, lte, not, is, order, limit. Same
// general shape as session-9.test.ts's mock with the date-range methods
// added.
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
      ilike(col: string, pattern: string) {
        const p = pattern.toLowerCase();
        if (p.startsWith('%') && p.endsWith('%') && p.length > 2) {
          const needle = p.slice(1, -1);
          predicates.push((r) => String(r[col] ?? '').toLowerCase().includes(needle));
        } else if (p.startsWith('%')) {
          const needle = p.slice(1);
          predicates.push((r) => String(r[col] ?? '').toLowerCase().endsWith(needle));
        } else if (p.endsWith('%')) {
          const needle = p.slice(0, -1);
          predicates.push((r) => String(r[col] ?? '').toLowerCase().startsWith(needle));
        } else {
          predicates.push((r) => String(r[col] ?? '').toLowerCase() === p);
        }
        return builder;
      },
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

// Helpers — produce ISO date strings relative to NOW.
function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
}

describe('Change B — getCandidateUnits intent="mortgage_expiring"', () => {
  // Three buyers at one scheme, two of them inside the 60-day window.
  // Unit 5 (10 days out), Unit 12 (45 days out) → in cohort.
  // Unit 20 (120 days out) → outside the window.
  // Unit 30 (handed over already) → excluded even though mortgage date set.
  // Unit 40 (no mortgage_expiry_date) → excluded.
  const state = {
    developments: [{ id: 'dev-1', name: 'Lakeside Manor' }],
    units: [
      { id: 'u-5', development_id: 'dev-1', unit_number: '5', purchaser_name: 'Aoife Byrne' },
      { id: 'u-12', development_id: 'dev-1', unit_number: '12', purchaser_name: 'Rónán McCarthy' },
      { id: 'u-20', development_id: 'dev-1', unit_number: '20', purchaser_name: 'Mark Donnelly' },
      { id: 'u-30', development_id: 'dev-1', unit_number: '30', purchaser_name: 'Niamh O\'Brien' },
      { id: 'u-40', development_id: 'dev-1', unit_number: '40', purchaser_name: 'Cillian Walsh' },
    ],
    unit_sales_pipeline: [
      { unit_id: 'u-5', development_id: 'dev-1', mortgage_expiry_date: isoInDays(10), handover_date: null, purchaser_name: 'Aoife Byrne' },
      { unit_id: 'u-12', development_id: 'dev-1', mortgage_expiry_date: isoInDays(45), handover_date: null, purchaser_name: 'Rónán McCarthy' },
      { unit_id: 'u-20', development_id: 'dev-1', mortgage_expiry_date: isoInDays(120), handover_date: null, purchaser_name: 'Mark Donnelly' },
      { unit_id: 'u-30', development_id: 'dev-1', mortgage_expiry_date: isoInDays(15), handover_date: isoInDays(-5), purchaser_name: 'Niamh O\'Brien' },
      { unit_id: 'u-40', development_id: 'dev-1', mortgage_expiry_date: null, handover_date: null, purchaser_name: 'Cillian Walsh' },
    ],
  };

  it('default 60-day window includes the two in-window buyers and excludes the rest', async () => {
    const supabase = mockSupabase(state);
    const cands = await getCandidateUnits(supabase, 'mortgage_expiring', { developmentIds: ['dev-1'] });
    expect(cands).toHaveLength(2);
    // Soonest expiry first.
    expect(cands[0].unit_number).toBe('5');
    expect(cands[1].unit_number).toBe('12');
    // Status hint surfaces the days-to-expiry signal.
    expect(cands[0].status_hint).toMatch(/mortgage approval expires/i);
    expect(cands[0].status_hint).toMatch(/\d+d\)/);
    // Out-of-window / handed-over / null buyers must NOT appear.
    expect(cands.find((c) => c.unit_number === '20')).toBeUndefined();
    expect(cands.find((c) => c.unit_number === '30')).toBeUndefined();
    expect(cands.find((c) => c.unit_number === '40')).toBeUndefined();
  });

  it('every returned candidate has a mortgage_expiry_date within MORTGAGE_EXPIRY_WINDOW_DAYS', async () => {
    const supabase = mockSupabase(state);
    const cands = await getCandidateUnits(supabase, 'mortgage_expiring', { developmentIds: ['dev-1'] });
    const now = Date.now();
    const windowMs = MORTGAGE_EXPIRY_WINDOW_DAYS * 86400000;
    for (const c of cands) {
      const days = parseInt(c.status_hint.match(/\((\d+)d\)/)?.[1] ?? '-1', 10);
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(MORTGAGE_EXPIRY_WINDOW_DAYS);
      // Cross-check: days converts back to a timestamp inside the window.
      expect(days * 86400000).toBeLessThanOrEqual(windowMs);
      // Suppress unused-var warning when transpiled.
      void now;
    }
  });
});

describe('Change C — buildFollowupContent topic-fragment safety net', () => {
  it('ensureSentenceTerminator appends a period to a fragment', () => {
    expect(ensureSentenceTerminator('update on signing their contracts')).toBe(
      'update on signing their contracts.',
    );
  });

  it('ensureSentenceTerminator preserves an existing terminator', () => {
    expect(ensureSentenceTerminator('Where do things stand?')).toBe('Where do things stand?');
    expect(ensureSentenceTerminator('Just checking in.')).toBe('Just checking in.');
    expect(ensureSentenceTerminator('Sign the contracts now!')).toBe(
      'Sign the contracts now!',
    );
  });

  it('ensureSentenceTerminator returns empty for empty / whitespace input', () => {
    expect(ensureSentenceTerminator('')).toBe('');
    expect(ensureSentenceTerminator('   ')).toBe('');
  });

  // End-to-end via draftBuyerFollowups: even when the model passes a
  // bare fragment, the rendered body never reads as a stub line missing
  // its terminator. This is the production regression the audit caught.
  it('draftBuyerFollowups + fragment topic → body line ends with sentence terminator', async () => {
    const supabase = mockSupabase({
      developments: [{ id: 'dev-1', name: 'Lakeside Manor' }],
      units: [
        {
          id: 'u-12',
          development_id: 'dev-1',
          unit_number: '12',
          unit_uid: 'LM-12',
          purchaser_name: 'Rónán McCarthy',
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
          contracts_issued_date: isoInDays(-50),
          signed_contracts_date: null,
          counter_signed_date: null,
          purchaser_name: 'Rónán McCarthy',
          purchaser_email: 'ronan@example.com',
        },
      ],
    });

    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX as any, {
      targets: [{ unit_identifier: '12', scheme_name: 'Lakeside Manor' }],
      topic: 'update on signing their contracts',
      purpose: 'chase',
    });

    expect(envelope.drafts).toHaveLength(1);
    const body = envelope.drafts[0].body;
    // Find the topic line in the body and assert it ends with a terminator.
    const topicLine = body
      .split('\n')
      .find((line) => line.toLowerCase().includes('update on signing their contracts'));
    expect(topicLine).toBeDefined();
    expect(topicLine!.trim()).toMatch(/[.!?]$/);
    // The fragment must NOT appear without its terminator.
    expect(body).not.toMatch(/update on signing their contracts\n/);
  });
});
