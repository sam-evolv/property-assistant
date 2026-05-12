/**
 * Session 5A regression guards for the post-viewing orchestrator.
 *
 * `executePostViewingCapture` is the function the demo depends on: one
 * utterance fans out into multiple silent mutations and one pending draft.
 * The tests below pin three invariants:
 *   1. Happy path auto-saves status, notes, reminders, and persists the
 *      follow-up draft to `pending_drafts` (status='pending_review',
 *      never sent).
 *   2. Partial failure returns an honest envelope — the steps that
 *      landed are reflected, the ones that failed are in `errors`.
 *   3. Follow-up email is NEVER auto-sent — it always lands as a draft.
 *
 * Hermetic — stubbed Supabase, stubbed extraction (via extractionOverride
 * so no OpenAI call is made).
 */

import {
  executePostViewingCapture,
  type PostViewingExtraction,
} from '../../lib/agent-intelligence/tools/voice-capture-tools';
import type { AgentContext } from '../../lib/agent-intelligence/types';

type Row = Record<string, any>;

interface MockState {
  viewings: Row[];
  agent_viewings?: Row[];
  agent_applicants: Row[];
  agent_tasks: Row[];
  pending_drafts: Row[];
  viewing_audit_log: Row[];
  developments?: Row[];
  /** Tables that should throw on any write. */
  failingTables?: Set<string>;
}

function makeSupabase(state: MockState) {
  const data: Record<string, Row[]> = {
    viewings: state.viewings,
    agent_viewings: state.agent_viewings ?? [],
    agent_applicants: state.agent_applicants,
    agent_tasks: state.agent_tasks,
    pending_drafts: state.pending_drafts,
    viewing_audit_log: state.viewing_audit_log,
    developments: state.developments ?? [],
  };

  function qb(table: string) {
    const filters: Row = {};
    const updates: Row[] = [];
    const builder: any = {
      eq(col: string, val: any) {
        filters[col] = val;
        return builder;
      },
      in(col: string, vals: any[]) {
        filters[`__in_${col}`] = vals;
        return builder;
      },
      neq() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      select() {
        return builder;
      },
      insert(row: Row | Row[]) {
        if (state.failingTables?.has(table)) {
          return {
            select: () => ({ single: async () => ({ data: null, error: { message: `insert failed: ${table}` } }) }),
          };
        }
        const arr = Array.isArray(row) ? row : [row];
        const inserted: Row[] = [];
        for (const r of arr) {
          const withId = { id: `${table}-${data[table].length + 1}`, ...r };
          data[table].push(withId);
          inserted.push(withId);
        }
        return {
          select() {
            return {
              async single() {
                return { data: inserted[0], error: null };
              },
            };
          },
          // Direct await on insert returns ok status.
          then(resolve: any) {
            return Promise.resolve({ data: inserted, error: null }).then(resolve);
          },
        };
      },
      update(row: Row) {
        updates.push(row);
        return {
          eq() {
            return builder;
          },
          select() {
            return {
              async single() {
                if (state.failingTables?.has(table)) {
                  return { data: null, error: { message: `update failed: ${table}` } };
                }
                const target = (data[table] as Row[]).find((r) =>
                  Object.entries(filters).every(([k, v]) =>
                    k.startsWith('__in_') ? (v as any[]).includes(r[k.slice(5)]) : r[k] === v,
                  ),
                );
                if (target) Object.assign(target, row);
                return { data: target ?? null, error: null };
              },
            };
          },
          then(resolve: any) {
            if (state.failingTables?.has(table)) {
              return Promise.resolve({ data: null, error: { message: `update failed: ${table}` } }).then(resolve);
            }
            const matched = (data[table] as Row[]).filter((r) =>
              Object.entries(filters).every(([k, v]) =>
                k.startsWith('__in_') ? (v as any[]).includes(r[k.slice(5)]) : r[k] === v,
              ),
            );
            for (const m of matched) Object.assign(m, row);
            return Promise.resolve({ data: matched, error: null }).then(resolve);
          },
        };
      },
      async single() {
        const rows = (data[table] as Row[]).filter((r) =>
          Object.entries(filters).every(([k, v]) =>
            k.startsWith('__in_') ? (v as any[]).includes(r[k.slice(5)]) : r[k] === v,
          ),
        );
        return { data: rows[0] ?? null, error: null };
      },
      async maybeSingle() {
        const rows = (data[table] as Row[]).filter((r) =>
          Object.entries(filters).every(([k, v]) =>
            k.startsWith('__in_') ? (v as any[]).includes(r[k.slice(5)]) : r[k] === v,
          ),
        );
        return { data: rows[0] ?? null, error: null };
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

  return { from: (table: string) => qb(table) } as any;
}

const AGENT_CTX: AgentContext = {
  agentProfileId: 'profile-1' as any,
  authUserId: 'auth-1' as any,
  tenantId: 'tenant-1',
  displayName: 'Sarah O Reilly',
  agencyName: 'Bridge Property',
  agentType: 'sales',
  assignedSchemes: [],
  assignedDevelopmentIds: ['dev-1'],
  assignedDevelopmentNames: ['Lakeside Manor'],
  activeDevelopmentId: null,
  isDemoMode: true,
};

const BASE_VIEWING = {
  id: 'view-1',
  tenant_id: 'tenant-1',
  agent_id: 'auth-1',
  applicant_id: 'appl-1',
  development_id: 'dev-1',
  scheduled_at: '2026-05-13T16:00:00Z',
  duration_minutes: 30,
  location: 'Lakeside Manor',
  notes: null,
  status: 'scheduled',
  device_calendar_event_id: null,
};

const HIGH_INTEREST_EXTRACTION: PostViewingExtraction = {
  outcome: 'high_interest',
  structured_notes: [
    { category: 'concern', content: 'Worried about heating bills' },
    { category: 'question', content: 'Asked about upstairs bedroom dimensions' },
    { category: 'next_step', content: 'Follow up Friday morning' },
  ],
  next_actions: [
    {
      type: 'follow_up_email',
      timing: '2026-05-15',
      details: 'Send dimensions and BER info',
    },
  ],
  suggested_follow_up: {
    tone: 'warm',
    subject: 'Following up on your viewing at Lakeside Manor',
    body: "Hi Niamh,\n\nGreat to see you yesterday. I'll get those upstairs dimensions over to you Friday morning.\n\nCheers,\nSarah",
    addresses_concerns: ['Worried about heating bills', 'Asked about upstairs bedroom dimensions'],
  },
  confidence: 'high',
};

describe('executePostViewingCapture — happy path', () => {
  it('auto-saves viewing status, notes, reminders, and writes one pending draft', async () => {
    const supabase = makeSupabase({
      viewings: [{ ...BASE_VIEWING }],
      agent_applicants: [{ id: 'appl-1', tenant_id: 'tenant-1', full_name: "Niamh O'Brien", notes: null }],
      agent_tasks: [],
      pending_drafts: [],
      viewing_audit_log: [],
      developments: [{ id: 'dev-1', name: 'Lakeside Manor' }],
    });

    const result = await executePostViewingCapture(
      supabase,
      AGENT_CTX,
      { transcript: 'long enough transcript to clear the low-confidence floor', viewing_id: 'view-1' },
      { extractionOverride: HIGH_INTEREST_EXTRACTION },
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.saved.viewing_status).toBe('completed');
    expect(result.saved.notes_added).toBe(3);
    expect(result.saved.reminders_created).toBe(1);
    expect(result.pending_approval.follow_up_email).not.toBeNull();
    expect(result.pending_approval.follow_up_email!.pending_draft_id).toMatch(/pending_drafts/);
  });

  it('never marks the follow-up draft as sent — status must remain pending_review', async () => {
    const drafts: Row[] = [];
    const supabase = makeSupabase({
      viewings: [{ ...BASE_VIEWING }],
      agent_applicants: [{ id: 'appl-1', tenant_id: 'tenant-1', full_name: "Niamh O'Brien", notes: null }],
      agent_tasks: [],
      pending_drafts: drafts,
      viewing_audit_log: [],
    });

    await executePostViewingCapture(
      supabase,
      AGENT_CTX,
      { transcript: 'long enough transcript to clear the low-confidence floor', viewing_id: 'view-1' },
      { extractionOverride: HIGH_INTEREST_EXTRACTION },
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe('pending_review');
    expect(drafts[0].send_method).toBe('email');
    expect(drafts[0].draft_type).toBe('viewing_followup');
  });

  it('skips the status update when the viewing is already completed', async () => {
    const supabase = makeSupabase({
      viewings: [{ ...BASE_VIEWING, status: 'completed' }],
      agent_applicants: [{ id: 'appl-1', tenant_id: 'tenant-1', full_name: "Niamh O'Brien", notes: null }],
      agent_tasks: [],
      pending_drafts: [],
      viewing_audit_log: [],
    });

    const result = await executePostViewingCapture(
      supabase,
      AGENT_CTX,
      { transcript: 'long enough transcript to clear the low-confidence floor', viewing_id: 'view-1' },
      { extractionOverride: HIGH_INTEREST_EXTRACTION },
    );

    // Already-terminal viewings keep their status; orchestrator surfaces
    // the existing status so the UI can render "Marked completed".
    expect(result.saved.viewing_status).toBe('completed');
    expect(result.errors).toHaveLength(0);
  });
});

describe('executePostViewingCapture — partial failure', () => {
  it('returns ok=false with a populated errors[] when the draft insert fails', async () => {
    const supabase = makeSupabase({
      viewings: [{ ...BASE_VIEWING }],
      agent_applicants: [{ id: 'appl-1', tenant_id: 'tenant-1', full_name: "Niamh O'Brien", notes: null }],
      agent_tasks: [],
      pending_drafts: [],
      viewing_audit_log: [],
      failingTables: new Set(['pending_drafts']),
    });

    const result = await executePostViewingCapture(
      supabase,
      AGENT_CTX,
      { transcript: 'long enough transcript to clear the low-confidence floor', viewing_id: 'view-1' },
      { extractionOverride: HIGH_INTEREST_EXTRACTION },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.step === 'persist_draft')).toBe(true);
    // The follow-up draft is still surfaced (body+subject) so the UI can
    // show the agent what was written even though it didn't land in the
    // inbox.
    expect(result.pending_approval.follow_up_email).not.toBeNull();
    expect(result.pending_approval.follow_up_email!.pending_draft_id).toBeNull();
  });

  it('returns a resolve_viewing error envelope when the viewing is not in the tenant', async () => {
    const supabase = makeSupabase({
      viewings: [],
      agent_applicants: [],
      agent_tasks: [],
      pending_drafts: [],
      viewing_audit_log: [],
    });

    const result = await executePostViewingCapture(
      supabase,
      AGENT_CTX,
      { transcript: 'plenty of words to pass the floor', viewing_id: 'view-1' },
      { extractionOverride: HIGH_INTEREST_EXTRACTION },
    );

    expect(result.ok).toBe(false);
    expect(result.errors[0].step).toBe('resolve_viewing');
    expect(result.saved.viewing_status).toBeNull();
    expect(result.pending_approval.follow_up_email).toBeNull();
  });
});

describe('executePostViewingCapture — does not auto-send', () => {
  it('only ever writes drafts with status="pending_review" (never "sent")', async () => {
    const drafts: Row[] = [];
    const supabase = makeSupabase({
      viewings: [{ ...BASE_VIEWING }],
      agent_applicants: [{ id: 'appl-1', tenant_id: 'tenant-1', full_name: "Niamh O'Brien", notes: null }],
      agent_tasks: [],
      pending_drafts: drafts,
      viewing_audit_log: [],
    });

    const r1 = await executePostViewingCapture(
      supabase,
      AGENT_CTX,
      { transcript: 'enough words here for the floor check', viewing_id: 'view-1' },
      { extractionOverride: HIGH_INTEREST_EXTRACTION },
    );
    expect(r1.ok).toBe(true);

    for (const d of drafts) {
      expect(d.status).toBe('pending_review');
    }
  });

  it('surfaces clarifications when extraction confidence is low', async () => {
    const supabase = makeSupabase({
      viewings: [{ ...BASE_VIEWING }],
      agent_applicants: [{ id: 'appl-1', tenant_id: 'tenant-1', full_name: "Niamh O'Brien", notes: null }],
      agent_tasks: [],
      pending_drafts: [],
      viewing_audit_log: [],
    });

    const lowConf: PostViewingExtraction = {
      ...HIGH_INTEREST_EXTRACTION,
      confidence: 'low',
    };

    const result = await executePostViewingCapture(
      supabase,
      AGENT_CTX,
      { transcript: 'enough words here for the floor check', viewing_id: 'view-1' },
      { extractionOverride: lowConf },
    );

    expect(result.confidence).toBe('low');
    expect(result.pending_approval.clarifications.length).toBeGreaterThan(0);
  });
});
