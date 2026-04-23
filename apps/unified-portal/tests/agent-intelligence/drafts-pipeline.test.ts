/**
 * Session 6D regression guards.
 *
 * Protect two specific invariants that broke in production:
 *   1. Every draft-producing tool funnels through persistDraftsForEnvelope
 *      (no skill may claim success without writing to pending_drafts).
 *   2. The new draft_message / draft_buyer_followups skills produce real
 *      envelopes with drafts[] populated.
 *
 * Hermetic — stubbed Supabase, no network.
 */

import {
  draftMessageSkill,
  draftBuyerFollowups,
} from '../../lib/agent-intelligence/tools/agentic-skills';
import { AGENT_TOOL_DEFINITIONS } from '../../lib/agent-intelligence/tools/registry';
import { persistDraftsForEnvelope } from '../../lib/agent-intelligence/draft-store';
import { isAgenticSkillEnvelope } from '../../lib/agent-intelligence/envelope';

const SKILL_CTX = {
  agentId: 'profile-1',
  userId: 'user-1',
  displayName: 'Orla Hennessy',
  agencyName: 'Hennessy Property',
};

type Row = Record<string, any>;

function mockSupabase(state: {
  developments?: Row[];
  units?: Row[];
  agent_scheme_assignments?: Row[];
  pending_drafts?: Row[];
}) {
  const data = {
    developments: state.developments ?? [],
    units: state.units ?? [],
    agent_scheme_assignments: state.agent_scheme_assignments ?? [],
    pending_drafts: state.pending_drafts ?? [],
  };

  function qb(table: keyof typeof data) {
    const filters: Row = {};
    const ins: Row[] = [];
    const builder: any = {
      eq(col: string, val: any) { filters[col] = val; return builder; },
      in(col: string, vals: any[]) { filters[`__in_${col}`] = vals; return builder; },
      ilike() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      not() { return builder; },
      is() { return builder; },
      or() { return builder; },
      select() { return builder; },
      insert(row: Row) {
        const withId = { id: `row-${data[table].length + 1}`, ...row };
        data[table].push(withId);
        ins.push(withId);
        return {
          select() { return { single: async () => ({ data: withId, error: null }) }; },
        };
      },
      async single() { return { data: (data[table] as Row[])[0] ?? null, error: null }; },
      async maybeSingle() {
        const rows = data[table] as Row[];
        const match = rows.find((r) =>
          Object.entries(filters).every(([k, v]) =>
            k.startsWith('__in_') ? (v as any[]).includes(r[k.slice(5)]) : r[k] === v,
          ),
        ) ?? null;
        return { data: match, error: null };
      },
      then(resolve: any) {
        const rows = (data[table] as Row[]).filter((r) =>
          Object.entries(filters).every(([k, v]) =>
            k.startsWith('__in_') ? (v as any[]).includes(r[k.slice(5)]) : r[k] === v,
          ),
        );
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return builder;
  }

  return { from: (table: string) => qb(table as any) } as any;
}

describe('draftMessageSkill (Session 6D)', () => {
  it('returns a valid envelope with one draft persisted through the helper', async () => {
    const supabase = mockSupabase({
      developments: [{ id: 'dev-1', name: 'Árdan View' }],
      units: [
        {
          id: 'unit-50',
          development_id: 'dev-1',
          unit_number: '50',
          unit_uid: 'AV-50',
          purchaser_email: 'laura@example.com',
          purchaser_name: 'Laura Hayes',
        },
      ],
    });

    const envelope = await draftMessageSkill(supabase, SKILL_CTX, {
      recipient_type: 'buyer',
      recipient_name: 'Laura Hayes',
      context: "Checking when you expect to have the contracts signed.",
      tone: 'gentle_chase',
      related_unit: '50',
      related_scheme: 'Árdan View',
    });

    expect(isAgenticSkillEnvelope(envelope)).toBe(true);
    expect(envelope.drafts).toHaveLength(1);
    expect(envelope.drafts[0].recipient?.email).toBe('laura@example.com');
    expect(envelope.drafts[0].body).toContain('Laura');
    expect(envelope.drafts[0].subject).toContain('Unit 50');
    expect(envelope.summary.toLowerCase()).toContain('drafted email to laura');

    // End-to-end: envelope flows through persistDraftsForEnvelope without
    // errors, rows land in pending_drafts, ids are rewritten.
    const persisted = await persistDraftsForEnvelope(supabase, envelope, {
      userId: SKILL_CTX.userId,
      tenantId: 'tenant-1',
      skill: envelope.skill,
    });
    expect(persisted.drafts[0].id).not.toBe(envelope.drafts[0].id); // rewritten
  });

  it('returns a clear failure envelope when recipient name is missing', async () => {
    const supabase = mockSupabase({});
    const envelope = await draftMessageSkill(supabase, SKILL_CTX, {
      recipient_type: 'buyer',
      recipient_name: '',
      context: 'hi',
    } as any);
    expect(envelope.drafts).toHaveLength(0);
    expect(envelope.summary).toMatch(/required/i);
  });
});

describe('draftBuyerFollowups (Session 6D)', () => {
  it('produces one draft per resolved unit in a single envelope', async () => {
    const supabase = mockSupabase({
      developments: [{ id: 'dev-1', name: 'Árdan View' }],
      units: [
        { id: 'u-19', development_id: 'dev-1', unit_number: '19', unit_uid: 'AV-19', purchaser_name: 'Laura Hayes', purchaser_email: 'laura@example.com' },
        { id: 'u-37', development_id: 'dev-1', unit_number: '37', unit_uid: 'AV-37', purchaser_name: 'Dylan Rogers', purchaser_email: 'dylan@example.com' },
        { id: 'u-36', development_id: 'dev-1', unit_number: '36', unit_uid: 'AV-36', purchaser_name: 'Prem Rai', purchaser_email: 'prem@example.com' },
      ],
      agent_scheme_assignments: [
        { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
      ],
    });

    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX, {
      targets: [
        { unit_identifier: '19', scheme_name: 'Árdan View' },
        { unit_identifier: '37', scheme_name: 'Árdan View' },
        { unit_identifier: '36', scheme_name: 'Árdan View' },
      ],
      topic: 'Asking when they expect to sign the contracts.',
    });

    expect(envelope.drafts.length).toBe(3);
    expect(envelope.summary).toMatch(/Drafted 3/);
    for (const d of envelope.drafts) {
      expect(d.body.length).toBeGreaterThan(50);
      expect(d.affected_record.kind).toBe('sales_unit');
    }
  });

  it('returns an empty-drafts envelope (not a hallucination) when no targets resolve', async () => {
    const supabase = mockSupabase({
      developments: [{ id: 'dev-1', name: 'Árdan View' }],
      units: [],
      agent_scheme_assignments: [
        { agent_id: 'profile-1', development_id: 'dev-1', is_active: true },
      ],
    });
    const envelope = await draftBuyerFollowups(supabase, SKILL_CTX, {
      targets: [{ unit_identifier: '999', scheme_name: 'Árdan View' }],
      topic: 'something',
    });
    expect(envelope.drafts).toHaveLength(0);
    expect(envelope.summary).toMatch(/could not resolve/i);
  });
});

describe('Tool registry invariant (Session 6D)', () => {
  it('every tool named like a draft-producer is wired through runAgenticSkill', () => {
    const DRAFT_PRODUCERS = new Set([
      'draft_message',
      'draft_buyer_followups',
      'chase_aged_contracts',
      'draft_viewing_followup',
      'draft_lease_renewal',
      'weekly_monday_briefing',
      'schedule_viewing_draft',
    ]);
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      if (!DRAFT_PRODUCERS.has(tool.name)) continue;
      // runAgenticSkill produces an anonymous arrow in registry.ts; the
      // identity guard here is "does it NOT point at a raw write-tools
      // function" — all raw write-tools functions are named. An arrow
      // wrapping a skill has empty name.
      expect(tool.execute.name).toBe('');
    }
  });

  // Session 6D hotfix: any `type: 'array'` parameter MUST carry an `items`
  // sub-schema, otherwise OpenAI rejects the whole completion with a 400.
  // Any `type: 'object'` parameter MUST carry `properties`. Walk every tool
  // and assert both.
  it('every array parameter declares items, every object declares properties', () => {
    function walk(node: any, path: string): void {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'array') {
        expect(node.items).toBeDefined();
        expect(typeof node.items?.type).toBe('string');
        walk(node.items, `${path}.items`);
      }
      if (node.type === 'object' && node !== undefined) {
        expect(node.properties).toBeDefined();
        for (const [key, child] of Object.entries(node.properties || {})) {
          walk(child, `${path}.${key}`);
        }
      }
    }
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      walk(tool.parameters, tool.name);
    }
  });
});
