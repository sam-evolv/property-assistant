/**
 * Unit tests for planBroadcast.
 *
 * Hermetic. The OpenAI client is stubbed for both the filter-parse and
 * the email-drafting steps. Supabase is stubbed with an in-memory store
 * keyed by table name so the recipient resolver can be exercised against
 * controlled enquiry rows.
 *
 * Test shapes:
 *   - planBroadcast parses a simple filter (Lakeside Manor) and returns
 *     the right cohort + emails.
 *   - zero matches surface a needs_clarification with a sample.
 *   - >200 matches surface a too_many_recipients clarification.
 *   - the email drafter respects the never-invent rule (mock LLM returns
 *     output, scrubber strips em dashes and AI filler).
 */

import {
  planBroadcast,
  type BroadcastDraftEnvelope,
  type BroadcastClarification,
} from '../../lib/agent-intelligence/tools/broadcast-tools';
import type { AgentContext } from '../../lib/agent-intelligence/types';
import type { AgentProfileId, AuthUserId } from '../../lib/agent-intelligence/ids';

interface EnquiryRow {
  id: string;
  tenant_id: string;
  enquirer_name: string | null;
  enquirer_email: string | null;
  development_id: string | null;
  status: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

interface FakeStore {
  enquiries: EnquiryRow[];
  agent_applicants: Array<{ id: string; tenant_id: string; email: string | null }>;
}

function makeFakeSupabase(store: FakeStore) {
  return {
    from(table: string) {
      const filters: Record<string, any> = {};
      const inFilters: Record<string, any[]> = {};
      let orderField: string | null = null;
      let orderAsc = true;
      let limitN: number | null = null;
      let notNullField: string | null = null;
      let orClause: string | null = null;

      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: any) {
          filters[col] = val;
          return builder;
        },
        in(col: string, vals: any[]) {
          inFilters[col] = vals;
          return builder;
        },
        not(col: string, _op: string, _val: any) {
          notNullField = col;
          return builder;
        },
        or(clause: string) {
          orClause = clause;
          return builder;
        },
        order(field: string, opts?: { ascending?: boolean }) {
          orderField = field;
          orderAsc = opts?.ascending ?? true;
          return builder;
        },
        limit(n: number) {
          limitN = n;
          return builder;
        },
        async then(resolve: (v: any) => void) {
          resolve(await this._exec());
        },
        async _exec() {
          let rows: any[] = [];
          if (table === 'enquiries') {
            rows = store.enquiries.filter((r) => {
              for (const [k, v] of Object.entries(filters)) {
                if ((r as any)[k] !== v) return false;
              }
              for (const [k, vals] of Object.entries(inFilters)) {
                if (!vals.includes((r as any)[k])) return false;
              }
              if (notNullField === 'enquirer_email' && r.enquirer_email == null) return false;
              if (orClause && orClause.includes('last_contacted_at')) {
                const m = orClause.match(/last_contacted_at\.lt\.([^,)]+)/);
                if (m) {
                  const cutoff = m[1];
                  if (r.last_contacted_at !== null && r.last_contacted_at >= cutoff) return false;
                }
              }
              return true;
            });
            if (orderField) {
              rows.sort((a, b) => {
                const av = (a as any)[orderField!] ?? '';
                const bv = (b as any)[orderField!] ?? '';
                if (av === bv) return 0;
                return orderAsc ? (av < bv ? -1 : 1) : av < bv ? 1 : -1;
              });
            }
            if (limitN != null) rows = rows.slice(0, limitN);
            return { data: rows, error: null };
          }
          if (table === 'agent_applicants') {
            rows = store.agent_applicants.filter((r) => {
              for (const [k, v] of Object.entries(filters)) {
                if ((r as any)[k] !== v) return false;
              }
              for (const [k, vals] of Object.entries(inFilters)) {
                if (!vals.includes((r as any)[k])) return false;
              }
              return true;
            });
            return { data: rows, error: null };
          }
          if (table === 'agent_viewings') {
            return { data: [], error: null };
          }
          return { data: [], error: null };
        },
      };
      return builder;
    },
  } as any;
}

const AGENT_CTX: AgentContext = {
  agentProfileId: 'profile-1' as AgentProfileId,
  authUserId: 'auth-1' as AuthUserId,
  tenantId: 'tenant-1',
  displayName: 'Sarah Mitchell',
  agencyName: 'Bridge Property Group',
  agentType: 'sales',
  assignedSchemes: [],
  assignedDevelopmentIds: ['dev-lakeside'],
  assignedDevelopmentNames: ['Lakeside Manor'],
  activeDevelopmentId: null,
  isDemoMode: true,
};

function stubFilterAndEmailClient(
  filterPayload: any,
  emailPayload: any,
): any {
  let call = 0;
  return {
    chat: {
      completions: {
        async create() {
          call++;
          const payload = call === 1 ? filterPayload : emailPayload;
          return {
            choices: [{ message: { content: JSON.stringify(payload) } }],
          };
        },
      },
    },
  };
}

const LAKESIDE_ENQUIRIES: EnquiryRow[] = [
  {
    id: 'enq-1',
    tenant_id: 'tenant-1',
    enquirer_name: "Niamh O'Brien",
    enquirer_email: 'niamh@example.ie',
    development_id: 'dev-lakeside',
    status: 'active',
    last_contacted_at: '2026-05-01T10:00:00Z',
    created_at: '2026-04-15T10:00:00Z',
  },
  {
    id: 'enq-2',
    tenant_id: 'tenant-1',
    enquirer_name: 'Cian Murphy',
    enquirer_email: 'cian@example.ie',
    development_id: 'dev-lakeside',
    status: 'new',
    last_contacted_at: null,
    created_at: '2026-04-20T11:00:00Z',
  },
  {
    id: 'enq-3',
    tenant_id: 'tenant-1',
    enquirer_name: 'Aoife Walsh',
    enquirer_email: 'aoife@example.ie',
    development_id: 'dev-lakeside',
    status: 'warm',
    last_contacted_at: '2026-05-05T14:00:00Z',
    created_at: '2026-04-25T09:00:00Z',
  },
];

describe('planBroadcast', () => {
  it('parses a simple scheme filter and drafts one email per recipient', async () => {
    const store: FakeStore = { enquiries: LAKESIDE_ENQUIRIES, agent_applicants: [] };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(
      {
        interested_in_scheme_names: ['Lakeside Manor'],
        has_active_enquiry: null,
        viewed_property_names: [],
        last_contact_before_days: null,
        status: [],
        confidence: 'high',
      },
      {
        emails: [
          {
            recipient_index: 0,
            subject: 'Saturday viewings at Lakeside Manor',
            body: 'Hi Aoife,\n\nI will be in the show house this Saturday from 10 to 2.\n\nCheers,\nSarah',
          },
          {
            recipient_index: 1,
            subject: 'Saturday viewings at Lakeside Manor',
            body: 'Hi Cian,\n\nI will be in the show house this Saturday from 10 to 2.\n\nCheers,\nSarah',
          },
          {
            recipient_index: 2,
            subject: 'Saturday viewings at Lakeside Manor',
            body: 'Hi Niamh,\n\nI will be in the show house this Saturday from 10 to 2.\n\nCheers,\nSarah',
          },
        ],
      },
    );

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      {
        intent:
          'I will be available for viewings in the show house this Saturday between 10am and 2pm.',
        filter_natural: 'everyone interested in Lakeside Manor',
        tone: 'warm',
      },
      { client },
    );

    expect(result.data.status).toBe('draft');
    const draft = result.data as BroadcastDraftEnvelope;
    expect(draft.type).toBe('broadcast');
    expect(draft.tone).toBe('warm');
    expect(draft.filter_used.interested_in_scheme_ids).toEqual(['dev-lakeside']);
    expect(draft.recipients.length).toBe(3);
    expect(draft.recipients.map((r) => r.email).sort()).toEqual([
      'aoife@example.ie',
      'cian@example.ie',
      'niamh@example.ie',
    ]);
    expect(draft.emails.length).toBe(3);
    for (const email of draft.emails) {
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.body.length).toBeGreaterThan(0);
      expect(email.body).not.toMatch(/\u2014/);
      expect(email.body.toLowerCase()).not.toContain('i hope this finds you well');
    }
  });

  it('returns needs_clarification when no applicants match the filter', async () => {
    const store: FakeStore = { enquiries: [], agent_applicants: [] };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(
      {
        interested_in_scheme_names: ['Lakeside Manor'],
        has_active_enquiry: null,
        viewed_property_names: [],
        last_contact_before_days: null,
        status: [],
        confidence: 'high',
      },
      { emails: [] },
    );

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      {
        intent: 'Saturday viewings 10-2',
        filter_natural: 'everyone interested in Lakeside Manor',
      },
      { client },
    );

    expect(result.data.status).toBe('needs_clarification');
    const clar = result.data as BroadcastClarification;
    expect(clar.reason).toBe('no_recipients_match');
    expect(clar.recipient_count).toBe(0);
  });

  it('returns needs_clarification when too many applicants match', async () => {
    const many: EnquiryRow[] = Array.from({ length: 210 }, (_, i) => ({
      id: `enq-${i}`,
      tenant_id: 'tenant-1',
      enquirer_name: `Person ${i}`,
      enquirer_email: `person${i}@example.ie`,
      development_id: 'dev-lakeside',
      status: 'active',
      last_contacted_at: null,
      created_at: '2026-04-01T00:00:00Z',
    }));
    const store: FakeStore = { enquiries: many, agent_applicants: [] };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(
      {
        interested_in_scheme_names: ['Lakeside Manor'],
        has_active_enquiry: null,
        viewed_property_names: [],
        last_contact_before_days: null,
        status: [],
        confidence: 'high',
      },
      { emails: [] },
    );

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      {
        intent: 'Saturday viewings 10-2',
        filter_natural: 'everyone interested in Lakeside Manor',
      },
      { client, maxRecipients: 200 },
    );

    expect(result.data.status).toBe('needs_clarification');
    const clar = result.data as BroadcastClarification;
    expect(clar.reason).toBe('too_many_recipients');
    expect(clar.recipient_count).toBe(210);
  });

  it('refuses unresolved scheme names rather than broadcasting to a wider cohort', async () => {
    const store: FakeStore = { enquiries: LAKESIDE_ENQUIRIES, agent_applicants: [] };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(
      {
        interested_in_scheme_names: ['Sunnyvale Towers'],
        has_active_enquiry: null,
        viewed_property_names: [],
        last_contact_before_days: null,
        status: [],
        confidence: 'medium',
      },
      { emails: [] },
    );

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      {
        intent: 'Saturday viewings 10-2',
        filter_natural: 'everyone interested in Sunnyvale Towers',
      },
      { client },
    );

    expect(result.data.status).toBe('needs_clarification');
    const clar = result.data as BroadcastClarification;
    expect(clar.reason).toBe('filter_unparseable');
    expect(clar.message).toMatch(/Sunnyvale Towers/);
  });

  it('scrubs em dashes from the LLM-drafted body before returning', async () => {
    const store: FakeStore = { enquiries: LAKESIDE_ENQUIRIES.slice(0, 1), agent_applicants: [] };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(
      {
        interested_in_scheme_names: ['Lakeside Manor'],
        has_active_enquiry: null,
        viewed_property_names: [],
        last_contact_before_days: null,
        status: [],
        confidence: 'high',
      },
      {
        emails: [
          {
            recipient_index: 0,
            subject: 'Saturday viewings \u2014 Lakeside Manor',
            body: 'Hi Niamh \u2014 quick note about Saturday. Cheers, Sarah',
          },
        ],
      },
    );

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      {
        intent: 'Saturday viewings 10-2',
        filter_natural: 'everyone interested in Lakeside Manor',
      },
      { client },
    );

    const draft = result.data as BroadcastDraftEnvelope;
    expect(draft.emails[0].body).not.toMatch(/\u2014/);
  });

  it('rejects empty intent and empty filter_natural with distinct reasons', async () => {
    const store: FakeStore = { enquiries: LAKESIDE_ENQUIRIES, agent_applicants: [] };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient({}, {});

    const noIntent = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      { filter_natural: 'everyone interested in Lakeside Manor' },
      { client },
    );
    expect(noIntent.data.status).toBe('needs_clarification');
    expect((noIntent.data as BroadcastClarification).reason).toBe('no_intent');

    const noFilter = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      { intent: 'Saturday viewings 10-2' },
      { client },
    );
    expect(noFilter.data.status).toBe('needs_clarification');
    expect((noFilter.data as BroadcastClarification).reason).toBe('no_filter');
  });
});
