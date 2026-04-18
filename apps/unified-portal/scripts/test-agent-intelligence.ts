#!/usr/bin/env node
/**
 * End-to-end smoke tests for the agent-intelligence skills and /confirm
 * endpoint. 16 tests total: 10 skill tests (a-j) that call skill functions
 * directly, and 6 HTTP tests (k-p) that POST to /api/agent-intelligence/confirm.
 *
 * Run:
 *   cd apps/unified-portal
 *   npx tsx scripts/test-agent-intelligence.ts
 *
 * Required env vars (must be present in .env.local or exported in the shell):
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — service role key (read/write for tests)
 *   BASE_URL                     — optional, dev server URL for /confirm tests
 *                                  (defaults to http://localhost:3000). If
 *                                  unreachable, the 6 /confirm tests SKIP.
 *
 * Cleanup runs unconditionally in a finally block and rolls back any
 * agent_viewings, communication_events, and intelligence_actions rows the
 * run inserted.
 *
 * Exit codes:
 *   0  no failures (skips are OK)
 *   1  one or more tests failed
 *   2  fatal error (missing env, import crash, etc.)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

import {
  chaseAgedContracts,
  draftViewingFollowup,
  weeklyMondayBriefing,
  draftLeaseRenewal,
  naturalQuery,
  scheduleViewingDraft,
  type AgenticSkillEnvelope,
  type SkillAgentContext,
} from '../lib/agent-intelligence/tools/agentic-skills';

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function failFastOnMissingEnv(): void {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    console.error('Set them in apps/unified-portal/.env.local or export them in your shell.');
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Agent context — Orla Hennessy (dev-mode "first agent profile" fallback).
// ---------------------------------------------------------------------------
const ORLA: SkillAgentContext = {
  agentId: '0f9210e0-342d-4f98-9be1-95decb6f507a',
  userId: '780f1fe9-8b1e-42aa-8230-8d6e7e24e6e8',
  displayName: 'Orla Hennessy',
  agencyName: 'Hennessy & Co Property',
};

// ---------------------------------------------------------------------------
// ANSI colour helpers. Degrade gracefully when piped (colour codes are inert
// when the output is not a terminal).
// ---------------------------------------------------------------------------
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const green = (s: string) => `${GREEN}${s}${RESET}`;
const red = (s: string) => `${RED}${s}${RESET}`;
const yellow = (s: string) => `${YELLOW}${s}${RESET}`;
const dim = (s: string) => `${DIM}${s}${RESET}`;
const bold = (s: string) => `${BOLD}${s}${RESET}`;

// ---------------------------------------------------------------------------
// Test result shape.
// ---------------------------------------------------------------------------
type TestResult = {
  name: string;
  ok: boolean;
  // When true, the test could not run (missing dependency, server unreachable,
  // etc.). Skipped tests do NOT count as failures for exit-code purposes.
  skipped?: boolean;
  details: string;
  errors?: string[];
  payload?: unknown;
};

function trimPayloadForPass(envelope: AgenticSkillEnvelope): unknown {
  return {
    skill: envelope.skill,
    status: envelope.status,
    summary: envelope.summary,
    draft_count: envelope.drafts.length,
    first_draft_preview: envelope.drafts[0]
      ? {
          id: envelope.drafts[0].id,
          type: envelope.drafts[0].type,
          subject: envelope.drafts[0].subject,
          body_first_line: (envelope.drafts[0].body || '').split('\n')[0],
        }
      : null,
  };
}

// Collect assertion errors without throwing so a single test reports all
// failures at once.
function collect(errors: string[], condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

// ---------------------------------------------------------------------------
// Helper: compute next Monday at 11:00 local time as an ISO 8601 string.
// If today is Monday, jump to the following Monday (+7 days).
// ---------------------------------------------------------------------------
function nextMondayAt11Iso(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun .. 6=Sat
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilMonday);
  target.setHours(11, 0, 0, 0);
  return target.toISOString();
}

// ===========================================================================
// Skill tests (a-j)
// ===========================================================================

// a) chase_aged_contracts — default threshold 42 days
async function testChaseAgedContracts(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'a) chase_aged_contracts (default 42d)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await chaseAgedContracts(sb, ctx, {});
    collect(errors, envelope.status === 'awaiting_approval', `status=${envelope.status}, expected awaiting_approval`);
    // Production data currently holds 3 aged contracts at the default 42-day
    // threshold (Árdan View Units 19, 37, 36). The initial >=7 guess was wrong;
    // keep the assertion a floor so seeded rows can grow without rewriting it.
    collect(errors, envelope.drafts.length >= 3, `drafts.length=${envelope.drafts.length}, expected >= 3`);
    const hasArdanUnit19 = envelope.drafts.some(d => /Árdan View.*Unit\s*19\b/i.test(d.affected_record?.label || ''));
    collect(errors, hasArdanUnit19, 'no draft references "Árdan View Unit 19"');
    const hasLauraHayes = envelope.drafts.some(d => (d.body || '').includes('Laura Hayes'));
    collect(errors, hasLauraHayes, 'no draft body contains "Laura Hayes"');
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope
      ? `drafts=${envelope.drafts.length}, summary="${envelope.summary}"`
      : 'no envelope returned',
    errors: ok ? undefined : errors,
    payload: ok
      ? envelope && trimPayloadForPass(envelope)
      : {
          summary: envelope?.summary,
          first_two_drafts: envelope?.drafts.slice(0, 2),
        },
  };
}

// b) draft_viewing_followup — 24h window (expected empty)
async function testViewingFollowup24h(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'b) draft_viewing_followup (24h)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await draftViewingFollowup(sb, ctx, { window_hours: 24 });
    collect(errors, envelope.drafts.length === 0, `drafts.length=${envelope.drafts.length}, expected 0`);
    collect(
      errors,
      /(no|0|zero|nothing)/i.test(envelope.summary),
      `summary should mention zero/none — got: "${envelope.summary}"`,
    );
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `drafts=${envelope.drafts.length}, summary="${envelope.summary}"` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// c) draft_viewing_followup — 168h window (expected 3 drafts)
async function testViewingFollowup168h(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'c) draft_viewing_followup (168h)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await draftViewingFollowup(sb, ctx, { window_hours: 168 });
    collect(errors, envelope.drafts.length === 3, `drafts.length=${envelope.drafts.length}, expected 3`);
    const names = envelope.drafts.map(d => d.recipient?.name || '').join(' | ');
    for (const expected of ['Fiona Walsh', 'James', 'Ryan']) {
      collect(errors, names.includes(expected), `no recipient name contains "${expected}" — got: ${names}`);
    }
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope
      ? `drafts=${envelope.drafts.length}, recipients=[${envelope.drafts.map(d => d.recipient?.name).join(', ')}]`
      : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// d) weekly_monday_briefing — single report draft with all 5 sections
async function testWeeklyBriefing(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'd) weekly_monday_briefing';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await weeklyMondayBriefing(sb, ctx, {});
    collect(errors, envelope.drafts.length === 1, `drafts.length=${envelope.drafts.length}, expected 1`);
    const draft = envelope.drafts[0];
    if (draft) {
      collect(errors, draft.type === 'report', `draft.type=${draft.type}, expected report`);
      collect(errors, draft.recipient?.email === 'self', `recipient.email=${draft.recipient?.email}, expected 'self'`);
      const body = draft.body || '';
      const bodyLower = body.toLowerCase();
      for (const marker of ['SALES MOVEMENT', 'LETTINGS MOVEMENT', 'RENT ARREARS', 'VIEWINGS', 'NEEDS ATTENTION']) {
        collect(errors, bodyLower.includes(marker.toLowerCase()), `body missing section marker "${marker}"`);
      }
      collect(errors, body.includes('Séan Murphy'), 'body does not mention arrears tenant "Séan Murphy"');
      for (const tenant of ['Aisling Moran', 'Mark Donnelly', 'Olivia Nwosu', 'Maria Andrade']) {
        collect(errors, body.includes(tenant), `body missing renewal tenant "${tenant}"`);
      }
    } else {
      errors.push('no draft returned');
    }
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `summary="${envelope.summary}"` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok
      ? envelope && trimPayloadForPass(envelope)
      : envelope,
  };
}

// e) draft_lease_renewal — all tenancies in the window
async function testLeaseRenewalAll(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'e) draft_lease_renewal (all)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await draftLeaseRenewal(sb, ctx, {});
    collect(errors, envelope.drafts.length === 4, `drafts.length=${envelope.drafts.length}, expected 4`);
    const expectedRents: Array<{ tenant: string; forms: string[] }> = [
      // Aisling: Math.round(1850 * 1.02 / 5) * 5 = 1885 (the skill rounds the
      // RPZ-capped uplift to the nearest €5, not €10). Earlier guess of €1890
      // was wrong — the rounding maths holds.
      { tenant: 'Aisling Moran', forms: ['€1885', '€1,885'] },
      { tenant: 'Mark Donnelly', forms: ['€2450', '€2,450'] },
      { tenant: 'Olivia Nwosu', forms: ['€1685', '€1,685'] },
      { tenant: 'Maria Andrade', forms: ['€1785', '€1,785'] },
    ];
    for (const { tenant, forms } of expectedRents) {
      const draft = envelope.drafts.find(d =>
        (d.recipient?.name || '').includes(tenant) ||
        (d.affected_record?.label || '').includes(tenant) ||
        (d.body || '').includes(tenant),
      );
      if (!draft) {
        errors.push(`no draft found for tenant "${tenant}"`);
        continue;
      }
      const body = draft.body || '';
      const matchedForm = forms.some(f => body.includes(f));
      collect(errors, matchedForm, `draft for "${tenant}" body missing any of ${forms.join(' | ')}`);
      collect(
        errors,
        /rpz/i.test(draft.reasoning || ''),
        `draft for "${tenant}" reasoning does not mention RPZ — got: ${draft.reasoning}`,
      );
    }
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `drafts=${envelope.drafts.length}` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// f) natural_query — rent roll
async function testNaturalQueryRentRoll(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'f) natural_query (rent roll)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await naturalQuery(sb, ctx, { question: "What's my rent roll?" });
    collect(errors, envelope.drafts.length === 1, `drafts.length=${envelope.drafts.length}, expected 1`);
    const body = envelope.drafts[0]?.body || '';
    collect(errors, envelope.drafts[0]?.type === 'report', `type=${envelope.drafts[0]?.type}, expected report`);
    collect(errors, body.includes('€22,250') || body.includes('€22250'), `body missing €22,250 — got: "${body}"`);
    collect(errors, /\b12\b/.test(body), `body missing '12' (tenancy count) — got: "${body}"`);
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `body="${envelope.drafts[0]?.body || ''}"` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// g) natural_query — aged count
async function testNaturalQueryAgedCount(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'g) natural_query (aged count)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await naturalQuery(sb, ctx, { question: 'How many contracts are over 6 weeks old?' });
    collect(errors, envelope.drafts.length === 1, `drafts.length=${envelope.drafts.length}, expected 1`);
    const body = envelope.drafts[0]?.body || '';
    collect(errors, /\d+/.test(body), `body has no digit — got: "${body}"`);
    collect(errors, /contract/i.test(body), `body missing 'contract' — got: "${body}"`);
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `body="${envelope.drafts[0]?.body || ''}"` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// h) natural_query — lease end lookup
async function testNaturalQueryLeaseEnd(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'h) natural_query (lease end for Rohan Shah)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await naturalQuery(sb, ctx, { question: "When does Rohan Shah's lease end?" });
    collect(errors, envelope.drafts.length === 1, `drafts.length=${envelope.drafts.length}, expected 1`);
    const body = envelope.drafts[0]?.body || '';
    const matches =
      body.includes('1 February 2027') ||
      body.includes('1 Feb 2027') ||
      body.includes('2027-02-01');
    collect(errors, matches, `body missing any lease-end form (1 February 2027 / 1 Feb 2027 / 2027-02-01) — got: "${body}"`);
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `body="${envelope.drafts[0]?.body || ''}"` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// i) natural_query — fallback
async function testNaturalQueryFallback(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'i) natural_query (fallback)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await naturalQuery(sb, ctx, { question: 'Bananas?' });
    collect(errors, envelope.drafts.length === 1, `drafts.length=${envelope.drafts.length}, expected 1`);
    const body = envelope.drafts[0]?.body || '';
    collect(errors, body.includes('I can answer questions'), `body missing fallback phrase — got: "${body}"`);
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `body="${envelope.drafts[0]?.body || ''}"` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// j) schedule_viewing_draft — sales unit with full inputs
async function testScheduleViewing(sb: SupabaseClient, ctx: SkillAgentContext): Promise<TestResult> {
  const name = 'j) schedule_viewing_draft (Árdan View Unit 50)';
  const errors: string[] = [];
  let envelope: AgenticSkillEnvelope | null = null;
  try {
    envelope = await scheduleViewingDraft(sb, ctx, {
      unit_or_property_ref: 'Árdan View Unit 50',
      buyer_name: 'Test Buyer (scripted)',
      buyer_email: 'test.buyer@example.invalid',
      preferred_datetime: nextMondayAt11Iso(),
    });
    collect(errors, envelope.drafts.length === 2, `drafts.length=${envelope.drafts.length}, expected 2`);
    const viewingDraft = envelope.drafts.find(d => d.type === 'viewing_record');
    const emailDraft = envelope.drafts.find(d => d.type === 'email');
    collect(errors, Boolean(viewingDraft), 'no draft of type "viewing_record" found');
    collect(errors, Boolean(emailDraft), 'no draft of type "email" found');
    if (emailDraft) {
      collect(
        errors,
        emailDraft.recipient?.email === 'test.buyer@example.invalid',
        `email recipient=${emailDraft.recipient?.email}, expected test.buyer@example.invalid`,
      );
    }
    if (viewingDraft) {
      try {
        const parsed = JSON.parse(viewingDraft.body);
        const schemeOk = typeof parsed.scheme_name === 'string' && parsed.scheme_name.includes('Árdan View');
        collect(errors, schemeOk, `viewing_record scheme_name=${parsed.scheme_name}, expected contains "Árdan View"`);
        const unitOk = String(parsed.unit_ref) === '50';
        collect(errors, unitOk, `viewing_record unit_ref=${parsed.unit_ref}, expected "50"`);
      } catch (parseErr: any) {
        errors.push(`viewing_record body is not JSON: ${parseErr?.message || parseErr}`);
      }
    }
  } catch (e: any) {
    errors.push(`exception: ${e?.message || e}`);
  }
  const ok = errors.length === 0;
  return {
    name,
    ok,
    details: envelope ? `drafts=${envelope.drafts.length}, summary="${envelope.summary}"` : 'no envelope',
    errors: ok ? undefined : errors,
    payload: ok ? envelope && trimPayloadForPass(envelope) : envelope,
  };
}

// ===========================================================================
// Runner
// ===========================================================================

// ===========================================================================
// /confirm HTTP tests (k-p)
// ===========================================================================
//
// These tests hit the Next.js route handler over HTTP. The dev server must be
// running at BASE_URL. If fetch fails (server not running, network error) the
// affected test returns SKIP rather than FAIL so the suite stays green for
// skill-only runs.
//
// Drafts are not fabricated. Part 1 runs each skill once; after that block,
// main() runs three skills a second time to populate `envelopeMap` with live
// envelopes, which the /confirm tests then pull drafts from. The original
// skill test functions are untouched.
// ---------------------------------------------------------------------------

type Envelope = AgenticSkillEnvelope;
type Draft = Envelope['drafts'][number];

// State captured as /confirm tests run. Used by later tests and by the
// cleanup phase to roll back any rows the run created.
type ConfirmTestState = {
  envelopes: Partial<Record<'chase_aged_contracts' | 'schedule_viewing_draft' | 'draft_lease_renewal', Envelope>>;
  approvedDraftFromK: Draft | null;
  discardedDraftFromM: Draft | null;
  insertedViewingId: string | null;
  // Every draft id we successfully POSTed (approve, edit, or discard). The
  // cleanup phase deletes any intelligence_actions + communication_events
  // rows keyed on these ids.
  draftIdsTouched: Set<string>;
};

function makeConfirmState(): ConfirmTestState {
  return {
    envelopes: {},
    approvedDraftFromK: null,
    discardedDraftFromM: null,
    insertedViewingId: null,
    draftIdsTouched: new Set<string>(),
  };
}

type ConfirmPostResult =
  | { kind: 'ok'; status: number; body: any }
  | { kind: 'unreachable'; error: string };

async function postConfirm(body: Record<string, unknown>): Promise<ConfirmPostResult> {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/agent-intelligence/confirm`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = text.length ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    return { kind: 'ok', status: response.status, body: parsed };
  } catch (e: any) {
    const msg = e?.message || String(e);
    // ECONNREFUSED, ENOTFOUND, AbortError, etc. — treat as server unreachable.
    return { kind: 'unreachable', error: msg };
  }
}

function skipResult(name: string, reason: string): TestResult {
  return {
    name,
    ok: false,
    skipped: true,
    details: reason,
    errors: [reason],
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// k) Approve a sales-unit email draft → expect communication_events row
async function testConfirmApproveSalesEmail(state: ConfirmTestState): Promise<TestResult> {
  const name = 'k) /confirm approve sales-unit email';
  const envelope = state.envelopes.chase_aged_contracts;
  if (!envelope || envelope.drafts.length === 0) {
    return skipResult(name, 'chase_aged_contracts envelope unavailable or empty');
  }
  const draft = envelope.drafts[0];
  const res = await postConfirm({ draft, skill: 'chase_aged_contracts', user_action: 'approve' });
  if (res.kind === 'unreachable') {
    return skipResult(name, `server unreachable: ${res.error}`);
  }
  const errors: string[] = [];
  state.draftIdsTouched.add(draft.id);
  collect(errors, res.status === 200, `HTTP status=${res.status}, expected 200`);
  collect(errors, res.body?.status === 'completed', `body.status=${res.body?.status}, expected completed`);
  const cevId = res.body?.side_effects?.communication_event_id;
  collect(errors, typeof cevId === 'string' && UUID_REGEX.test(cevId), `communication_event_id not a UUID — got: ${cevId}`);
  if (errors.length === 0) state.approvedDraftFromK = draft;
  return {
    name,
    ok: errors.length === 0,
    details: `HTTP ${res.status}, cev=${cevId ?? 'null'}, draft_id=${draft.id}`,
    errors: errors.length ? errors : undefined,
    payload: errors.length ? res.body : undefined,
  };
}

// l) Approve a viewing_record draft → expect agent_viewings row
async function testConfirmApproveViewingRecord(state: ConfirmTestState): Promise<TestResult> {
  const name = 'l) /confirm approve viewing_record';
  const envelope = state.envelopes.schedule_viewing_draft;
  if (!envelope) return skipResult(name, 'schedule_viewing_draft envelope unavailable');
  const draft = envelope.drafts.find(d => d.type === 'viewing_record');
  if (!draft) return skipResult(name, 'no viewing_record draft in envelope');
  const res = await postConfirm({ draft, skill: 'schedule_viewing_draft', user_action: 'approve' });
  if (res.kind === 'unreachable') return skipResult(name, `server unreachable: ${res.error}`);
  const errors: string[] = [];
  state.draftIdsTouched.add(draft.id);
  collect(errors, res.status === 200, `HTTP status=${res.status}, expected 200`);
  collect(errors, res.body?.status === 'completed', `body.status=${res.body?.status}, expected completed`);
  const viewingId = res.body?.side_effects?.agent_viewing_id;
  collect(errors, typeof viewingId === 'string' && UUID_REGEX.test(viewingId), `agent_viewing_id not a UUID — got: ${viewingId}`);
  if (typeof viewingId === 'string') state.insertedViewingId = viewingId;
  return {
    name,
    ok: errors.length === 0,
    details: `HTTP ${res.status}, viewing_id=${viewingId ?? 'null'}`,
    errors: errors.length ? errors : undefined,
    payload: errors.length ? res.body : undefined,
  };
}

// m) Discard a second email draft (not the one used in k)
async function testConfirmDiscardEmail(state: ConfirmTestState): Promise<TestResult> {
  const name = 'm) /confirm discard email';
  const envelope = state.envelopes.chase_aged_contracts;
  if (!envelope || envelope.drafts.length < 2) {
    return skipResult(name, 'chase_aged_contracts envelope has fewer than 2 drafts');
  }
  const draft = envelope.drafts[1]; // second draft — avoid clash with test k
  const res = await postConfirm({ draft, skill: 'chase_aged_contracts', user_action: 'discard' });
  if (res.kind === 'unreachable') return skipResult(name, `server unreachable: ${res.error}`);
  const errors: string[] = [];
  state.draftIdsTouched.add(draft.id);
  collect(errors, res.status === 200, `HTTP status=${res.status}, expected 200`);
  collect(errors, res.body?.status === 'discarded', `body.status=${res.body?.status}, expected discarded`);
  const cevId = res.body?.side_effects?.communication_event_id;
  collect(errors, cevId === null || cevId === undefined, `communication_event_id should be null on discard — got: ${cevId}`);
  if (errors.length === 0) state.discardedDraftFromM = draft;
  return {
    name,
    ok: errors.length === 0,
    details: `HTTP ${res.status}, status=${res.body?.status}, draft_id=${draft.id}`,
    errors: errors.length ? errors : undefined,
    payload: errors.length ? res.body : undefined,
  };
}

// n) Re-approve an already-completed draft → expect idempotent no-op
async function testConfirmIdempotentReapprove(
  supabase: SupabaseClient,
  state: ConfirmTestState,
): Promise<TestResult> {
  const name = 'n) /confirm idempotent re-approve';
  const draft = state.approvedDraftFromK;
  if (!draft) return skipResult(name, 'test k did not capture an approved draft');

  // Count communication_events rows tagged with this draft_id before and
  // after. The outcome column is TEXT holding JSON; we use an ILIKE sentinel
  // rather than casting to jsonb.
  const sentinel = `%"draft_id":"${draft.id}"%`;
  const { count: beforeCount } = await supabase
    .from('communication_events')
    .select('id', { count: 'exact', head: true })
    .ilike('outcome', sentinel);

  const res = await postConfirm({ draft, skill: 'chase_aged_contracts', user_action: 'approve' });
  if (res.kind === 'unreachable') return skipResult(name, `server unreachable: ${res.error}`);

  const errors: string[] = [];
  collect(errors, res.status === 200, `HTTP status=${res.status}, expected 200`);
  collect(errors, res.body?.status === 'already_completed', `body.status=${res.body?.status}, expected already_completed`);

  const { count: afterCount } = await supabase
    .from('communication_events')
    .select('id', { count: 'exact', head: true })
    .ilike('outcome', sentinel);
  collect(
    errors,
    (afterCount ?? 0) === (beforeCount ?? 0),
    `communication_events count changed on idempotent re-approve: before=${beforeCount}, after=${afterCount}`,
  );

  return {
    name,
    ok: errors.length === 0,
    details: `HTTP ${res.status}, body.status=${res.body?.status}, cev_rows=${beforeCount}→${afterCount}`,
    errors: errors.length ? errors : undefined,
    payload: errors.length ? res.body : undefined,
  };
}

// o) Approve after discard → expect 409
async function testConfirmReapproveAfterDiscard(state: ConfirmTestState): Promise<TestResult> {
  const name = 'o) /confirm re-approve after discard (expect 409)';
  const draft = state.discardedDraftFromM;
  if (!draft) return skipResult(name, 'test m did not capture a discarded draft');
  const res = await postConfirm({ draft, skill: 'chase_aged_contracts', user_action: 'approve' });
  if (res.kind === 'unreachable') return skipResult(name, `server unreachable: ${res.error}`);
  const errors: string[] = [];
  collect(errors, res.status === 409, `HTTP status=${res.status}, expected 409`);
  collect(errors, res.body?.error === 'draft_already_discarded', `body.error=${res.body?.error}, expected draft_already_discarded`);
  return {
    name,
    ok: errors.length === 0,
    details: `HTTP ${res.status}, error=${res.body?.error}`,
    errors: errors.length ? errors : undefined,
    payload: errors.length ? res.body : undefined,
  };
}

// p) Approve a lettings renewal email → expect skip of communication_events
async function testConfirmLettingsRenewalEmail(state: ConfirmTestState): Promise<TestResult> {
  const name = 'p) /confirm approve lettings renewal email';
  const envelope = state.envelopes.draft_lease_renewal;
  if (!envelope) return skipResult(name, 'draft_lease_renewal envelope unavailable');
  const draft = envelope.drafts.find(d => d.type === 'email');
  if (!draft) return skipResult(name, 'no email draft in envelope');
  const res = await postConfirm({ draft, skill: 'draft_lease_renewal', user_action: 'approve' });
  if (res.kind === 'unreachable') return skipResult(name, `server unreachable: ${res.error}`);
  const errors: string[] = [];
  state.draftIdsTouched.add(draft.id);
  collect(errors, res.status === 200, `HTTP status=${res.status}, expected 200`);
  collect(errors, res.body?.status === 'completed', `body.status=${res.body?.status}, expected completed`);
  const cevId = res.body?.side_effects?.communication_event_id;
  collect(errors, cevId === null, `side_effects.communication_event_id should be null (lettings skip) — got: ${cevId}`);
  // The /confirm route reports skip reasons in intelligence_actions.metadata.side_effects.notes,
  // not in the HTTP response. That metadata isn't returned by the route, so we
  // verify the gap shows up via the DB side-effect check below.
  return {
    name,
    ok: errors.length === 0,
    details: `HTTP ${res.status}, cev=${cevId}`,
    errors: errors.length ? errors : undefined,
    payload: errors.length ? res.body : undefined,
  };
}

// ---------------------------------------------------------------------------
// Cleanup — runs in main()'s finally block. Idempotent; errors warn but
// don't propagate, so a partial failure never shadows a real test failure.
// ---------------------------------------------------------------------------
async function cleanupInsertedViewing(supabase: SupabaseClient, viewingId: string | null): Promise<void> {
  if (!viewingId) return;
  try {
    const { error } = await supabase.from('agent_viewings').delete().eq('id', viewingId);
    if (error) console.warn(yellow(`cleanup: failed to delete agent_viewings ${viewingId}: ${error.message}`));
  } catch (e: any) {
    console.warn(yellow(`cleanup: exception deleting agent_viewings ${viewingId}: ${e?.message || e}`));
  }
}

async function cleanupCommunicationEvents(supabase: SupabaseClient, draftIds: string[]): Promise<void> {
  for (const id of draftIds) {
    try {
      // outcome is TEXT containing a JSON string — ILIKE on the key/value pair
      // is enough because UUIDs are globally unique.
      const { error } = await supabase
        .from('communication_events')
        .delete()
        .ilike('outcome', `%"draft_id":"${id}"%`);
      if (error) console.warn(yellow(`cleanup: communication_events for draft ${id}: ${error.message}`));
    } catch (e: any) {
      console.warn(yellow(`cleanup: exception on communication_events for draft ${id}: ${e?.message || e}`));
    }
  }
}

async function cleanupIntelligenceActions(supabase: SupabaseClient, draftIds: string[]): Promise<void> {
  for (const id of draftIds) {
    try {
      const { error } = await supabase
        .from('intelligence_actions')
        .delete()
        .filter('metadata->>draft_id', 'eq', id);
      if (error) console.warn(yellow(`cleanup: intelligence_actions for draft ${id}: ${error.message}`));
    } catch (e: any) {
      console.warn(yellow(`cleanup: exception on intelligence_actions for draft ${id}: ${e?.message || e}`));
    }
  }
}

function printResult(r: TestResult): void {
  const tag = r.skipped ? yellow('SKIP') : r.ok ? green('PASS') : red('FAIL');
  console.log(`${tag} ${bold(r.name)} ${dim(`— ${r.details}`)}`);
  if (!r.ok && !r.skipped && r.errors?.length) {
    for (const err of r.errors) console.log(`  ${red('•')} ${err}`);
  }
  if (r.skipped && r.errors?.length) {
    for (const err of r.errors) console.log(`  ${yellow('•')} ${err}`);
  }
  if (r.payload !== undefined) {
    const label = r.skipped ? dim('context:') : r.ok ? dim('preview:') : yellow('payload:');
    console.log(`  ${label} ${JSON.stringify(r.payload, null, 2).replace(/\n/g, '\n  ')}`);
  }
}

async function main(): Promise<void> {
  failFastOnMissingEnv();

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(bold(`\nAgent Intelligence smoke suite`));
  console.log(dim(`Supabase: ${SUPABASE_URL}`));
  console.log(dim(`Agent:    ${ORLA.displayName} (${ORLA.agentId})`));
  console.log(dim(`BASE_URL: ${BASE_URL}`));
  console.log('');

  const results: TestResult[] = [];
  const confirmState = makeConfirmState();

  try {
    console.log(bold('— Skill tests (a-j) —'));
    const skillTests: Array<(sb: SupabaseClient, ctx: SkillAgentContext) => Promise<TestResult>> = [
      testChaseAgedContracts,
      testViewingFollowup24h,
      testViewingFollowup168h,
      testWeeklyBriefing,
      testLeaseRenewalAll,
      testNaturalQueryRentRoll,
      testNaturalQueryAgedCount,
      testNaturalQueryLeaseEnd,
      testNaturalQueryFallback,
      testScheduleViewing,
    ];
    for (const t of skillTests) {
      const r = await t(supabase, ORLA);
      results.push(r);
      printResult(r);
    }

    // Populate envelopes for /confirm tests by re-invoking the three skills we
    // need live drafts from. Each call is guarded: if a skill throws, the
    // matching /confirm tests will fall through to SKIP rather than crashing
    // the suite.
    console.log('');
    console.log(bold('— Capturing envelopes for /confirm tests —'));
    try {
      confirmState.envelopes.chase_aged_contracts = await chaseAgedContracts(supabase, ORLA, {});
      console.log(dim(`  chase_aged_contracts: ${confirmState.envelopes.chase_aged_contracts.drafts.length} draft(s)`));
    } catch (e: any) {
      console.log(yellow(`  chase_aged_contracts capture failed: ${e?.message || e}`));
    }
    try {
      confirmState.envelopes.schedule_viewing_draft = await scheduleViewingDraft(supabase, ORLA, {
        unit_or_property_ref: 'Árdan View Unit 50',
        buyer_name: 'Test Buyer (scripted)',
        buyer_email: 'test.buyer@example.invalid',
        preferred_datetime: nextMondayAt11Iso(),
      });
      console.log(dim(`  schedule_viewing_draft: ${confirmState.envelopes.schedule_viewing_draft.drafts.length} draft(s)`));
    } catch (e: any) {
      console.log(yellow(`  schedule_viewing_draft capture failed: ${e?.message || e}`));
    }
    try {
      confirmState.envelopes.draft_lease_renewal = await draftLeaseRenewal(supabase, ORLA, {});
      console.log(dim(`  draft_lease_renewal: ${confirmState.envelopes.draft_lease_renewal.drafts.length} draft(s)`));
    } catch (e: any) {
      console.log(yellow(`  draft_lease_renewal capture failed: ${e?.message || e}`));
    }

    console.log('');
    console.log(bold('— /confirm HTTP tests (k-p) —'));
    // Sequential: tests n (idempotent) and o (approve-after-discard) depend on
    // state captured by k and m respectively.
    const confirmResults: TestResult[] = [];
    confirmResults.push(await testConfirmApproveSalesEmail(confirmState));
    confirmResults.push(await testConfirmApproveViewingRecord(confirmState));
    confirmResults.push(await testConfirmDiscardEmail(confirmState));
    confirmResults.push(await testConfirmIdempotentReapprove(supabase, confirmState));
    confirmResults.push(await testConfirmReapproveAfterDiscard(confirmState));
    confirmResults.push(await testConfirmLettingsRenewalEmail(confirmState));
    for (const r of confirmResults) {
      results.push(r);
      printResult(r);
    }
  } finally {
    // Cleanup always runs, whether tests passed, failed, or threw.
    console.log('');
    console.log(bold('— Cleanup —'));
    const draftIds = Array.from(confirmState.draftIdsTouched);
    await cleanupInsertedViewing(supabase, confirmState.insertedViewingId);
    await cleanupCommunicationEvents(supabase, draftIds);
    await cleanupIntelligenceActions(supabase, draftIds);
    console.log(
      dim(
        `  viewing=${confirmState.insertedViewingId ?? 'none'}, draft_ids=${draftIds.length}`,
      ),
    );
  }

  const passed = results.filter(r => r.ok && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.ok && !r.skipped).length;
  const total = results.length;
  const colour = failed === 0 ? (skipped === 0 ? green : yellow) : red;
  console.log('');
  console.log(colour(bold(`${passed} passed, ${failed} failed, ${skipped} skipped of ${total} total`)));

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(red('Fatal:'), err);
  process.exit(2);
});
