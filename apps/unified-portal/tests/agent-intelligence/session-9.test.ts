/**
 * Session 9 regression guards.
 *
 * Covers:
 *   - normaliseUnitRef — "Unit 3" → "3", preserves alphanumeric codes
 *   - resolveUnitIdentifier — strict exact-match, no LIKE fuzz, ambiguity
 *   - getCandidateUnits — intent-aware filtering
 *   - draftBuyerFollowups — purpose preconditions + skipped telemetry
 *   - parseJointPurchaserNames — "Laura and Dylan" → one greeting
 *
 * Hermetic — stubbed Supabase, no network.
 */

import {
  normaliseUnitRef,
  resolveUnitIdentifier,
  getCandidateUnits,
} from '../../lib/agent-intelligence/unit-resolver';
import {
  draftBuyerFollowups,
  parseJointPurchaserNames,
} from '../../lib/agent-intelligence/tools/agentic-skills';

const SKILL_CTX = {
  agentId: 'profile-1',
  userId: 'user-1',
  displayName: 'Orla Hennessy',
  agencyName: 'Hennessy Property',
};

type Row = Record<string, any>;

// Richer mock than the Session 6D one — handles ilike suffix/prefix
// patterns, `not.is.null`, `is.null`, `lt`, and `order`.
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
      ilike(col: string, pattern: string) {
        // Support `%-N` (ends with "-N"), `%N%`, and `N%`.
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

describe('normaliseUnitRef', () => {
  it('strips "Unit "/"unit "/"#"', () => {
    expect(normaliseUnitRef('Unit 3')).toBe('3');
    expect(normaliseUnitRef('unit 3')).toBe('3');
    expect(normaliseUnitRef('Unit #3')).toBe('3');
    expect(normaliseUnitRef('#3')).toBe('3');
  });
  it('preserves alphanumeric uid', () => {
    expect(normaliseUnitRef('AV-3')).toBe('AV-3');
    expect(normaliseUnitRef('Unit AV-3')).toBe('AV-3');
  });
  it('collapses whitespace', () => {
    expect(normaliseUnitRef('Unit  3')).toBe('3');
  });
});

describe('resolveUnitIdentifier (Session 9)', () => {
  const stateOneScheme = {
    developments: [{ id: 'dev-1', name: 'Árdan View' }],
    units: [
      { id: 'u-3', development_id: 'dev-1', unit_number: '3', unit_uid: 'AV-3', purchaser_name: 'Robert and Cordelia Foley', purchaser_email: 'foleys@x.com', unit_status: 'handed_over' },
      { id: 'u-5', development_id: 'dev-1', unit_number: '5', unit_uid: 'AV-5', purchaser_name: 'Marcelo and Lislaine Acher', purchaser_email: 'achers@x.com', unit_status: 'handed_over' },
      { id: 'u-10', development_id: 'dev-1', unit_number: '10', unit_uid: 'AV-10', purchaser_name: 'Carmen Baumgartner', purchaser_email: 'carmen@x.com', unit_status: 'sale_agreed' },
      { id: 'u-13', development_id: 'dev-1', unit_number: '13', unit_uid: 'AV-13', purchaser_name: 'Laura Hayes and Dylan Rogers', purchaser_email: 'laura@x.com', unit_status: 'contracts_issued' },
      { id: 'u-30', development_id: 'dev-1', unit_number: '30', unit_uid: 'AV-30', purchaser_name: 'Prem Rai', purchaser_email: 'prem@x.com', unit_status: 'sale_agreed' },
    ],
    agent_scheme_assignments: [
      { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
    ],
    unit_sales_pipeline: [
      { unit_id: 'u-3', development_id: 'dev-1', handover_date: '2026-04-13', sale_agreed_date: '2026-01-15', contracts_issued_date: '2026-02-01', signed_contracts_date: '2026-02-20', counter_signed_date: '2026-02-25', deposit_date: '2026-01-20', purchaser_name: 'Robert and Cordelia Foley', purchaser_email: 'foleys@x.com' },
      { unit_id: 'u-5', development_id: 'dev-1', handover_date: '2026-04-15', sale_agreed_date: '2026-01-20', contracts_issued_date: '2026-02-05', signed_contracts_date: '2026-02-22', counter_signed_date: '2026-02-27', deposit_date: '2026-01-25', purchaser_name: 'Marcelo and Lislaine Acher', purchaser_email: 'achers@x.com' },
      { unit_id: 'u-10', development_id: 'dev-1', handover_date: null, sale_agreed_date: '2026-03-01', contracts_issued_date: null, signed_contracts_date: null, counter_signed_date: null, deposit_date: '2026-03-05', purchaser_name: 'Carmen Baumgartner', purchaser_email: 'carmen@x.com' },
    ],
  };

  it('"Unit 3" → Unit 3 (Foleys), NOT Unit 10', async () => {
    const supabase = mockSupabase(stateOneScheme);
    const r = await resolveUnitIdentifier(supabase, 'Unit 3', { developmentIds: ['dev-1'] });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.unit.id).toBe('u-3');
      expect(r.unit.purchaser_name).toContain('Foley');
      expect(r.pipeline?.handover_date).toBe('2026-04-13');
    }
  });

  it('"3" → Unit 3, NOT Unit 30, NOT Unit 13', async () => {
    const supabase = mockSupabase(stateOneScheme);
    const r = await resolveUnitIdentifier(supabase, '3', { developmentIds: ['dev-1'] });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.unit.id).toBe('u-3');
  });

  it('"Unit 300" in 86-unit estate → not_found', async () => {
    const supabase = mockSupabase(stateOneScheme);
    const r = await resolveUnitIdentifier(supabase, 'Unit 300', { developmentIds: ['dev-1'] });
    expect(r.status).toBe('not_found');
  });

  it('alphanumeric "AV-3" resolves via unit_uid exact match', async () => {
    const supabase = mockSupabase(stateOneScheme);
    const r = await resolveUnitIdentifier(supabase, 'AV-3', { developmentIds: ['dev-1'] });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.unit.id).toBe('u-3');
  });

  it('"Unit 3" across two schemes without scheme scope → ambiguous', async () => {
    const supabase = mockSupabase({
      developments: [
        { id: 'dev-1', name: 'Árdan View' },
        { id: 'dev-2', name: 'Rathárd Park' },
      ],
      units: [
        { id: 'u-av-3', development_id: 'dev-1', unit_number: '3', unit_uid: 'AV-3', purchaser_name: 'Foleys', purchaser_email: 'a@x.com', unit_status: 'handed_over' },
        { id: 'u-rp-3', development_id: 'dev-2', unit_number: '3', unit_uid: 'RP-3', purchaser_name: 'Someone Else', purchaser_email: 'b@x.com', unit_status: 'sale_agreed' },
      ],
      agent_scheme_assignments: [
        { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
        { agent_id: 'profile-1', development_id: 'dev-2', is_active: true },
      ],
    });
    const r = await resolveUnitIdentifier(supabase, 'Unit 3', { developmentIds: ['dev-1', 'dev-2'] });
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') {
      expect(r.candidates.length).toBe(2);
      expect(r.candidates.map((c) => c.scheme_name).sort()).toEqual(['Rathárd Park', 'Árdan View']);
    }
  });

  it('"Unit 3" with scheme scope → resolves to the right scheme', async () => {
    const supabase = mockSupabase({
      developments: [
        { id: 'dev-1', name: 'Árdan View' },
        { id: 'dev-2', name: 'Rathárd Park' },
      ],
      units: [
        { id: 'u-av-3', development_id: 'dev-1', unit_number: '3', unit_uid: 'AV-3', purchaser_name: 'Foleys', purchaser_email: 'a@x.com', unit_status: 'handed_over' },
        { id: 'u-rp-3', development_id: 'dev-2', unit_number: '3', unit_uid: 'RP-3', purchaser_name: 'Someone Else', purchaser_email: 'b@x.com', unit_status: 'sale_agreed' },
      ],
      agent_scheme_assignments: [
        { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
        { agent_id: 'profile-1', development_id: 'dev-2', is_active: true },
      ],
    });
    const r = await resolveUnitIdentifier(supabase, 'Unit 3', {
      developmentIds: ['dev-1', 'dev-2'],
      preferredDevelopmentId: 'dev-1',
    });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.unit.id).toBe('u-av-3');
  });
});

describe('getCandidateUnits — intent=handover (Session 9 Bug A)', () => {
  const state = {
    developments: [{ id: 'dev-1', name: 'Árdan View' }],
    units: [
      { id: 'u-3', development_id: 'dev-1', unit_number: '3', unit_uid: 'AV-3', purchaser_name: 'Foleys', unit_status: 'handed_over' },
      { id: 'u-5', development_id: 'dev-1', unit_number: '5', unit_uid: 'AV-5', purchaser_name: 'Achers', unit_status: 'handed_over' },
      { id: 'u-10', development_id: 'dev-1', unit_number: '10', unit_uid: 'AV-10', purchaser_name: 'Carmen', unit_status: 'sale_agreed' },
    ],
    unit_sales_pipeline: [
      { unit_id: 'u-3', development_id: 'dev-1', handover_date: '2026-04-13', purchaser_name: 'Foleys' },
      { unit_id: 'u-5', development_id: 'dev-1', handover_date: '2026-04-15', purchaser_name: 'Achers' },
      { unit_id: 'u-10', development_id: 'dev-1', handover_date: null, purchaser_name: 'Carmen' },
    ],
  };

  it('returns only the two handed-over units, most-recent first', async () => {
    const supabase = mockSupabase(state);
    const cands = await getCandidateUnits(supabase, 'handover', { developmentIds: ['dev-1'] });
    expect(cands).toHaveLength(2);
    // Most recent (Unit 5, 15 Apr) should come first.
    expect(cands[0].unit_number).toBe('5');
    expect(cands[1].unit_number).toBe('3');
    // Unit 10 must not appear.
    expect(cands.find((c) => c.unit_number === '10')).toBeUndefined();
  });
});

describe('draftBuyerFollowups — purpose precondition + resolver (Session 9)', () => {
  const state = {
    developments: [{ id: 'dev-1', name: 'Árdan View' }],
    units: [
      { id: 'u-3', development_id: 'dev-1', unit_number: '3', unit_uid: 'AV-3', purchaser_name: 'Robert and Cordelia Foley', purchaser_email: 'foleys@x.com', unit_status: 'handed_over' },
      { id: 'u-10', development_id: 'dev-1', unit_number: '10', unit_uid: 'AV-10', purchaser_name: 'Carmen Baumgartner', purchaser_email: 'carmen@x.com', unit_status: 'sale_agreed' },
    ],
    agent_scheme_assignments: [
      { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
    ],
    unit_sales_pipeline: [
      { unit_id: 'u-3', development_id: 'dev-1', handover_date: '2026-04-13', sale_agreed_date: '2026-01-15', contracts_issued_date: null, signed_contracts_date: null, counter_signed_date: null, deposit_date: null, purchaser_name: 'Robert and Cordelia Foley', purchaser_email: 'foleys@x.com' },
      { unit_id: 'u-10', development_id: 'dev-1', handover_date: null, sale_agreed_date: '2026-03-01', contracts_issued_date: null, signed_contracts_date: null, counter_signed_date: null, deposit_date: null, purchaser_name: 'Carmen Baumgartner', purchaser_email: 'carmen@x.com' },
    ],
  };

  it('"Unit 3" + congratulate_handover → one draft greeting Robert and Cordelia', async () => {
    const supabase = mockSupabase(state);
    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX, {
      targets: [{ unit_identifier: 'Unit 3', scheme_name: 'Árdan View' }],
      topic: '',
      purpose: 'congratulate_handover',
    });
    expect(envelope.drafts).toHaveLength(1);
    const d = envelope.drafts[0];
    expect(d.subject).toMatch(/^Welcome to your new home — Unit 3/);
    expect(d.body).toMatch(/Robert and Cordelia/);
    expect(d.body).toMatch(/[Cc]ongratulations/);
    // Must NOT have the chase tail.
    expect(d.body).not.toMatch(/where things stand/i);
    // Unit 10 did not come through — not in drafts, not greeted.
    expect(d.body).not.toMatch(/Carmen/);
  });

  it('"Unit 10" + congratulate_handover → refused (no handover_date), zero drafts, reason surfaced', async () => {
    const supabase = mockSupabase(state);
    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX, {
      targets: [{ unit_identifier: 'Unit 10', scheme_name: 'Árdan View' }],
      purpose: 'congratulate_handover',
    });
    expect(envelope.drafts).toHaveLength(0);
    expect(envelope.summary).toMatch(/Unit 10/);
    expect(envelope.summary).toMatch(/handover/i);
  });

  it('Unit 3 and Unit 10 together → 1 draft for Unit 3, Unit 10 skipped with reason', async () => {
    const supabase = mockSupabase(state);
    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX, {
      targets: [
        { unit_identifier: 'Unit 3', scheme_name: 'Árdan View' },
        { unit_identifier: 'Unit 10', scheme_name: 'Árdan View' },
      ],
      purpose: 'congratulate_handover',
    });
    expect(envelope.drafts).toHaveLength(1);
    expect(envelope.drafts[0].affected_record.id).toBe('u-3');
    expect(envelope.summary).toMatch(/Skipped/);
    expect(envelope.summary).toMatch(/Unit 10/);
  });

  it('Unit 3 × 2 (joint purchaser dedupe) → 1 draft', async () => {
    const supabase = mockSupabase(state);
    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX, {
      targets: [
        { unit_identifier: 'Unit 3', scheme_name: 'Árdan View', recipient_name: 'Robert Foley' },
        { unit_identifier: 'Unit 3', scheme_name: 'Árdan View', recipient_name: 'Cordelia Foley' },
      ],
      purpose: 'congratulate_handover',
    });
    expect(envelope.drafts).toHaveLength(1);
  });

  it('"Unit 300" (nonexistent) → zero drafts, skipped reason surfaced', async () => {
    const supabase = mockSupabase(state);
    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX, {
      targets: [{ unit_identifier: 'Unit 300', scheme_name: 'Árdan View' }],
      purpose: 'congratulate_handover',
    });
    expect(envelope.drafts).toHaveLength(0);
    expect(envelope.summary).toMatch(/No unit "300"/);
  });
});

describe('parseJointPurchaserNames (Session 9 base)', () => {
  it('single → one greeting', () => {
    expect(parseJointPurchaserNames('Robert Foley').greeting).toBe('Hi Robert,');
  });
  it('joint with "and" → both names', () => {
    expect(parseJointPurchaserNames('Robert and Cordelia Foley').greeting).toBe('Hi Robert and Cordelia,');
  });
  it('joint with "&" → both names', () => {
    expect(parseJointPurchaserNames('Marcelo & Lislaine Acher').greeting).toBe('Hi Marcelo and Lislaine,');
  });
  it('null → safe fallback', () => {
    expect(parseJointPurchaserNames(null).greeting).toBe('Hi there,');
  });
});
