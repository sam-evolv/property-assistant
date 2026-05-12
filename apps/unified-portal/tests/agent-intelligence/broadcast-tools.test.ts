/**
 * Unit tests for planBroadcast.
 *
 * Hermetic. The OpenAI client is stubbed for both the filter-parse and
 * the email-drafting steps. Supabase is stubbed with an in-memory store
 * keyed by table name so the recipient resolver can be exercised against
 * controlled rows in the canonical `viewings` table (with an applicant_id
 * FK into `agent_applicants`) and the denormalised `agent_viewings`
 * table (carries buyer_email / buyer_name directly).
 *
 * The fixtures here mirror the production data shape: most applicants
 * live in `viewings` -> `agent_applicants`, and only `agent_viewings`
 * has reliable buyer_email coverage. The dedupe step merges across both.
 */

import {
  planBroadcast,
  type BroadcastDraftEnvelope,
  type BroadcastClarification,
} from '../../lib/agent-intelligence/tools/broadcast-tools';
import type { AgentContext } from '../../lib/agent-intelligence/types';
import type { AgentProfileId, AuthUserId } from '../../lib/agent-intelligence/ids';

interface ViewingRow {
  id: string;
  tenant_id: string;
  applicant_id: string | null;
  development_id: string | null;
  status: string | null;
}

interface AgentViewingRow {
  id: string;
  tenant_id: string;
  development_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  status: string | null;
  created_at: string;
}

interface AgentApplicantRow {
  id: string;
  tenant_id: string;
  full_name: string | null;
  email: string | null;
}

interface FakeStore {
  viewings: ViewingRow[];
  agent_viewings: AgentViewingRow[];
  agent_applicants: AgentApplicantRow[];
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
          const filterRow = (r: any): boolean => {
            for (const [k, v] of Object.entries(filters)) {
              if ((r as any)[k] !== v) return false;
            }
            for (const [k, vals] of Object.entries(inFilters)) {
              if (!vals.includes((r as any)[k])) return false;
            }
            return true;
          };
          let rows: any[] = [];
          if (table === 'viewings') {
            rows = store.viewings.filter(filterRow);
          } else if (table === 'agent_viewings') {
            rows = store.agent_viewings
              .filter(filterRow)
              .filter((r) => (notNullField === 'buyer_email' ? r.buyer_email != null : true));
          } else if (table === 'agent_applicants') {
            rows = store.agent_applicants.filter(filterRow);
          } else {
            rows = [];
          }
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

function stubFilterAndEmailClient(filterPayload: any, emailPayload: any): any {
  let call = 0;
  return {
    chat: {
      completions: {
        async create() {
          call++;
          const payload = call === 1 ? filterPayload : emailPayload;
          return { choices: [{ message: { content: JSON.stringify(payload) } }] };
        },
      },
    },
  };
}

const LAKESIDE_FILTER_PAYLOAD = {
  interested_in_scheme_names: ['Lakeside Manor'],
  has_active_enquiry: null,
  viewed_property_names: [],
  last_contact_before_days: null,
  status: [],
  confidence: 'high',
};

const LAKESIDE_VIEWINGS: ViewingRow[] = [
  { id: 'v-1', tenant_id: 'tenant-1', applicant_id: 'ap-aoife', development_id: 'dev-lakeside', status: 'scheduled' },
  { id: 'v-2', tenant_id: 'tenant-1', applicant_id: 'ap-conor', development_id: 'dev-lakeside', status: 'completed' },
  { id: 'v-3', tenant_id: 'tenant-1', applicant_id: 'ap-sean', development_id: 'dev-lakeside', status: 'scheduled' },
  { id: 'v-4', tenant_id: 'tenant-1', applicant_id: 'ap-cancelled', development_id: 'dev-lakeside', status: 'cancelled' },
];

const LAKESIDE_APPLICANTS: AgentApplicantRow[] = [
  { id: 'ap-aoife', tenant_id: 'tenant-1', full_name: 'Aoife Kelly', email: 'aoife.kelly@example.ie' },
  { id: 'ap-conor', tenant_id: 'tenant-1', full_name: 'Conor Walsh', email: 'conor.walsh@example.ie' },
  { id: 'ap-sean', tenant_id: 'tenant-1', full_name: 'Sean Murphy', email: 'sean.murphy@example.ie' },
  { id: 'ap-cancelled', tenant_id: 'tenant-1', full_name: 'Cancelled Person', email: 'cancelled@example.ie' },
];

const EMAIL_PAYLOAD_THREE = {
  emails: [
    { recipient_index: 0, subject: 'Saturday viewings', body: 'Hi Aoife,\n\nSee you Saturday.\n\nCheers,\nSarah' },
    { recipient_index: 1, subject: 'Saturday viewings', body: 'Hi Conor,\n\nSee you Saturday.\n\nCheers,\nSarah' },
    { recipient_index: 2, subject: 'Saturday viewings', body: 'Hi Sean,\n\nSee you Saturday.\n\nCheers,\nSarah' },
  ],
};

describe('planBroadcast', () => {
  it('resolves "interested in Lakeside Manor" via the viewings join (regression for empty-recipients bug)', async () => {
    const store: FakeStore = {
      viewings: LAKESIDE_VIEWINGS,
      agent_viewings: [],
      agent_applicants: LAKESIDE_APPLICANTS,
    };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(LAKESIDE_FILTER_PAYLOAD, EMAIL_PAYLOAD_THREE);

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
    expect(draft.filter_used.interested_in_scheme_ids).toEqual(['dev-lakeside']);
    // Three scheduled or completed viewings produce three recipients;
    // the cancelled viewing is dropped at the resolver stage.
    expect(draft.recipients.length).toBe(3);
    expect(draft.recipients.map((r) => r.email).sort()).toEqual([
      'aoife.kelly@example.ie',
      'conor.walsh@example.ie',
      'sean.murphy@example.ie',
    ]);
    expect(draft.recipients.every((r) => r.applicant_id !== null)).toBe(true);
  });

  it('merges canonical viewings with denormalised agent_viewings on the same email', async () => {
    const store: FakeStore = {
      viewings: [
        { id: 'v-1', tenant_id: 'tenant-1', applicant_id: 'ap-niamh', development_id: 'dev-lakeside', status: 'scheduled' },
      ],
      agent_viewings: [
        {
          id: 'av-1',
          tenant_id: 'tenant-1',
          development_id: 'dev-lakeside',
          buyer_name: "Niamh O'Brien",
          buyer_email: 'niamh.obrien@example.ie',
          status: 'scheduled',
          created_at: '2026-05-01T10:00:00Z',
        },
        {
          id: 'av-2',
          tenant_id: 'tenant-1',
          development_id: 'dev-lakeside',
          buyer_name: 'Brian Murphy',
          buyer_email: 'brian.murphy@example.ie',
          status: 'completed',
          created_at: '2026-05-02T10:00:00Z',
        },
      ],
      agent_applicants: [
        { id: 'ap-niamh', tenant_id: 'tenant-1', full_name: "Niamh O'Brien", email: 'niamh.obrien@example.ie' },
      ],
    };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(LAKESIDE_FILTER_PAYLOAD, {
      emails: [
        { recipient_index: 0, subject: 'Saturday', body: 'Hi Brian,\n\nSaturday.\n\nCheers,\nSarah' },
        { recipient_index: 1, subject: 'Saturday', body: 'Hi Niamh,\n\nSaturday.\n\nCheers,\nSarah' },
      ],
    });

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      { intent: 'Saturday viewings 10-2', filter_natural: 'everyone interested in Lakeside Manor' },
      { client },
    );

    expect(result.data.status).toBe('draft');
    const draft = result.data as BroadcastDraftEnvelope;
    // Niamh appears in both tables; she should be deduped to a single
    // recipient that retains the applicant_id from the canonical side.
    expect(draft.recipients.length).toBe(2);
    const niamh = draft.recipients.find((r) => r.email === 'niamh.obrien@example.ie');
    expect(niamh?.applicant_id).toBe('ap-niamh');
    expect(draft.recipients.map((r) => r.email).sort()).toEqual([
      'brian.murphy@example.ie',
      'niamh.obrien@example.ie',
    ]);
  });

  it('returns needs_clarification when no applicants match the filter', async () => {
    const store: FakeStore = { viewings: [], agent_viewings: [], agent_applicants: [] };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(LAKESIDE_FILTER_PAYLOAD, { emails: [] });

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      { intent: 'Saturday viewings 10-2', filter_natural: 'everyone interested in Lakeside Manor' },
      { client },
    );

    expect(result.data.status).toBe('needs_clarification');
    const clar = result.data as BroadcastClarification;
    expect(clar.reason).toBe('no_recipients_match');
    expect(clar.recipient_count).toBe(0);
    // The clarification suggests rephrasing so the agent can tell apart
    // "filter genuinely matched nothing" from "filter wording was off".
    expect(clar.message).toMatch(/different phrasing|narrow the filter/i);
  });

  it('returns needs_clarification when too many applicants match', async () => {
    const manyViewings: ViewingRow[] = Array.from({ length: 210 }, (_, i) => ({
      id: `v-${i}`,
      tenant_id: 'tenant-1',
      applicant_id: `ap-${i}`,
      development_id: 'dev-lakeside',
      status: 'scheduled',
    }));
    const manyApplicants: AgentApplicantRow[] = Array.from({ length: 210 }, (_, i) => ({
      id: `ap-${i}`,
      tenant_id: 'tenant-1',
      full_name: `Person ${i}`,
      email: `person${i}@example.ie`,
    }));
    const store: FakeStore = {
      viewings: manyViewings,
      agent_viewings: [],
      agent_applicants: manyApplicants,
    };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(LAKESIDE_FILTER_PAYLOAD, { emails: [] });

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      { intent: 'Saturday viewings 10-2', filter_natural: 'everyone interested in Lakeside Manor' },
      { client, maxRecipients: 200 },
    );

    expect(result.data.status).toBe('needs_clarification');
    const clar = result.data as BroadcastClarification;
    expect(clar.reason).toBe('too_many_recipients');
    expect(clar.recipient_count).toBe(210);
  });

  it('refuses unresolved scheme names rather than broadcasting to a wider cohort', async () => {
    const store: FakeStore = {
      viewings: LAKESIDE_VIEWINGS,
      agent_viewings: [],
      agent_applicants: LAKESIDE_APPLICANTS,
    };
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
      { intent: 'Saturday viewings 10-2', filter_natural: 'everyone interested in Sunnyvale Towers' },
      { client },
    );

    expect(result.data.status).toBe('needs_clarification');
    const clar = result.data as BroadcastClarification;
    expect(clar.reason).toBe('filter_unparseable');
    expect(clar.message).toMatch(/Sunnyvale Towers/);
  });

  it('scrubs em dashes from the LLM-drafted body before returning', async () => {
    const store: FakeStore = {
      viewings: [LAKESIDE_VIEWINGS[0]],
      agent_viewings: [],
      agent_applicants: [LAKESIDE_APPLICANTS[0]],
    };
    const supabase = makeFakeSupabase(store);
    const client = stubFilterAndEmailClient(LAKESIDE_FILTER_PAYLOAD, {
      emails: [
        {
          recipient_index: 0,
          subject: 'Saturday viewings \u2014 Lakeside Manor',
          body: 'Hi Aoife \u2014 quick note about Saturday. Cheers, Sarah',
        },
      ],
    });

    const result = await planBroadcast(
      supabase,
      'tenant-1',
      AGENT_CTX,
      { intent: 'Saturday viewings 10-2', filter_natural: 'everyone interested in Lakeside Manor' },
      { client },
    );

    const draft = result.data as BroadcastDraftEnvelope;
    expect(draft.emails[0].body).not.toMatch(/\u2014/);
  });

  it('rejects empty intent and empty filter_natural with distinct reasons', async () => {
    const store: FakeStore = {
      viewings: LAKESIDE_VIEWINGS,
      agent_viewings: [],
      agent_applicants: LAKESIDE_APPLICANTS,
    };
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
