/**
 * Session 13 — scheme-name phonetic alias resolver tests.
 */

import {
  normaliseSchemeName,
  resolveSchemeName,
  suggestClosestScheme,
} from '../../lib/agent-intelligence/scheme-resolver';

const ARDAN_VIEW_ID = '11111111-1111-1111-1111-111111111111';
const RATHARD_PARK_ID = '22222222-2222-2222-2222-222222222222';
const HARBOUR_ID = '33333333-3333-3333-3333-333333333333';

const AGENT_CTX = {
  assignedDevelopmentIds: [ARDAN_VIEW_ID, RATHARD_PARK_ID, HARBOUR_ID],
  assignedDevelopmentNames: ['Árdan View', 'Rathárd Park', 'Harbour View Apartments'],
};

type Row = Record<string, any>;

function mockSupabase(aliases: Row[], developments?: Row[]) {
  const aliasRows = aliases;
  const devRows = developments || [];
  return {
    from(table: string) {
      const predicates: Array<(r: Row) => boolean> = [];
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
        order() { return builder; },
        limit() { return builder; },
        then(onResolve: any) {
          const source = table === 'development_aliases' ? aliasRows : devRows;
          const rows = source.filter((r) => predicates.every((p) => p(r)));
          return Promise.resolve({ data: rows, error: null }).then(onResolve);
        },
      };
      return builder;
    },
  } as any;
}

const baseAliases = [
  // Canonical rows
  { development_id: ARDAN_VIEW_ID, alias: 'Árdan View', alias_normalised: 'ardan view', source: 'canonical' },
  { development_id: RATHARD_PARK_ID, alias: 'Rathárd Park', alias_normalised: 'rathard park', source: 'canonical' },
  { development_id: HARBOUR_ID, alias: 'Harbour View Apartments', alias_normalised: 'harbour view apartments', source: 'canonical' },
  // Phonetic seeds for Árdan View
  { development_id: ARDAN_VIEW_ID, alias: 'Ardawn View', alias_normalised: 'ardawn view', source: 'phonetic_seed' },
  { development_id: ARDAN_VIEW_ID, alias: 'Arden View', alias_normalised: 'arden view', source: 'phonetic_seed' },
  { development_id: ARDAN_VIEW_ID, alias: 'Adan View', alias_normalised: 'adan view', source: 'phonetic_seed' },
  { development_id: ARDAN_VIEW_ID, alias: 'Add on View', alias_normalised: 'add on view', source: 'phonetic_seed' },
];

describe('normaliseSchemeName', () => {
  it('strips fadas and lowercases', () => {
    expect(normaliseSchemeName('Árdan View')).toBe('ardan view');
    expect(normaliseSchemeName('Rathárd Park')).toBe('rathard park');
  });
  it('strips punctuation and collapses whitespace', () => {
    expect(normaliseSchemeName('Add-on View')).toBe('add on view');
    expect(normaliseSchemeName('Árdan   View!')).toBe('ardan view');
    expect(normaliseSchemeName('   Rathárd Park   ')).toBe('rathard park');
  });
  it('is idempotent', () => {
    const once = normaliseSchemeName('Árdan View');
    const twice = normaliseSchemeName(once);
    expect(twice).toBe(once);
  });
});

describe('resolveSchemeName', () => {
  it('canonical name → ok', async () => {
    const supabase = mockSupabase(baseAliases);
    const r = await resolveSchemeName(supabase, 'Árdan View', AGENT_CTX);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.developmentId).toBe(ARDAN_VIEW_ID);
  });

  it('phonetic variant "Ardawn View" → Árdan View', async () => {
    const supabase = mockSupabase(baseAliases);
    const r = await resolveSchemeName(supabase, 'Ardawn View', AGENT_CTX);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.developmentId).toBe(ARDAN_VIEW_ID);
      expect(r.canonicalName).toBe('Árdan View');
    }
  });

  it('phonetic variant "Arden View" → Árdan View', async () => {
    const supabase = mockSupabase(baseAliases);
    const r = await resolveSchemeName(supabase, 'Arden View', AGENT_CTX);
    expect(r.ok).toBe(true);
  });

  it('phonetic variant "Add-on View" → Árdan View (punctuation stripped)', async () => {
    const supabase = mockSupabase(baseAliases);
    const r = await resolveSchemeName(supabase, 'Add-on View', AGENT_CTX);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.developmentId).toBe(ARDAN_VIEW_ID);
  });

  it('case-insensitive', async () => {
    const supabase = mockSupabase(baseAliases);
    const r = await resolveSchemeName(supabase, 'ARDAWN VIEW', AGENT_CTX);
    expect(r.ok).toBe(true);
  });

  it('nonexistent scheme → not_found with assigned candidates', async () => {
    const supabase = mockSupabase(baseAliases);
    const r = await resolveSchemeName(supabase, 'Castlebar View', AGENT_CTX);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('not_found');
      expect(r.candidates).toEqual(AGENT_CTX.assignedDevelopmentNames);
    }
  });

  it('not-assigned scheme → not_assigned', async () => {
    const FOREIGN_DEV_ID = '99999999-9999-9999-9999-999999999999';
    const aliases = [
      ...baseAliases,
      { development_id: FOREIGN_DEV_ID, alias: 'Foreign Scheme', alias_normalised: 'foreign scheme', source: 'canonical' },
    ];
    const supabase = mockSupabase(aliases);
    const r = await resolveSchemeName(supabase, 'Foreign Scheme', AGENT_CTX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_assigned');
  });

  it('ambiguous across schemes → ambiguous with candidates', async () => {
    // Two developments share the same phonetic alias (bad data — but
    // the resolver should surface it, not silently pick one).
    const aliases = [
      ...baseAliases,
      { development_id: RATHARD_PARK_ID, alias: 'Ardawn View', alias_normalised: 'ardawn view', source: 'inferred' },
    ];
    const supabase = mockSupabase(aliases, [
      { id: ARDAN_VIEW_ID, name: 'Árdan View' },
      { id: RATHARD_PARK_ID, name: 'Rathárd Park' },
    ]);
    const r = await resolveSchemeName(supabase, 'Ardawn View', AGENT_CTX);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('ambiguous');
      expect(r.candidates.length).toBe(2);
    }
  });

  it('empty input → not_found', async () => {
    const supabase = mockSupabase(baseAliases);
    const r = await resolveSchemeName(supabase, '', AGENT_CTX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });
});

describe('suggestClosestScheme', () => {
  it('"Ardan" → suggests Árdan View (low edit distance)', () => {
    const s = suggestClosestScheme('Ardan', AGENT_CTX);
    expect(s).toBe('Árdan View');
  });
  it('"Castlebar" → no suggestion (too different)', () => {
    const s = suggestClosestScheme('Castlebar', AGENT_CTX);
    expect(s).toBeNull();
  });
  it('"Harbour" → suggests Harbour View Apartments', () => {
    const s = suggestClosestScheme('Harbour', AGENT_CTX);
    expect(s).toBe('Harbour View Apartments');
  });
  it('empty input → null', () => {
    expect(suggestClosestScheme('', AGENT_CTX)).toBeNull();
  });
});
