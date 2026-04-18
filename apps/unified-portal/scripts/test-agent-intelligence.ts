#!/usr/bin/env node
/**
 * End-to-end smoke tests for the agent-intelligence skills and /confirm
 * endpoint. Part 1 of 2: skill tests (a-j). HTTP tests for /confirm (k-p)
 * are added in a follow-up session.
 *
 * Run:
 *   cd apps/unified-portal
 *   npx tsx scripts/test-agent-intelligence.ts
 *
 * Required env vars (must be present in .env.local or exported in the shell):
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — service role key (read/write for tests)
 *   BASE_URL                     — optional, used by part 2 (defaults to http://localhost:3000)
 *
 * Exit codes:
 *   0  all tests passed
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
    collect(errors, envelope.drafts.length >= 7, `drafts.length=${envelope.drafts.length}, expected >= 7`);
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
      { tenant: 'Aisling Moran', forms: ['€1890', '€1,890'] },
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

function printResult(r: TestResult): void {
  const tag = r.ok ? green('PASS') : red('FAIL');
  console.log(`${tag} ${bold(r.name)} ${dim(`— ${r.details}`)}`);
  if (!r.ok && r.errors?.length) {
    for (const err of r.errors) console.log(`  ${red('•')} ${err}`);
  }
  if (r.payload !== undefined) {
    const label = r.ok ? dim('preview:') : yellow('payload:');
    console.log(`  ${label} ${JSON.stringify(r.payload, null, 2).replace(/\n/g, '\n  ')}`);
  }
}

async function main(): Promise<void> {
  failFastOnMissingEnv();

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(bold(`\nAgent Intelligence smoke suite — part 1 (skill tests)`));
  console.log(dim(`Supabase: ${SUPABASE_URL}`));
  console.log(dim(`Agent:    ${ORLA.displayName} (${ORLA.agentId})`));
  console.log(dim(`BASE_URL: ${BASE_URL} (used by part 2)`));
  console.log('');

  const tests: Array<(sb: SupabaseClient, ctx: SkillAgentContext) => Promise<TestResult>> = [
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

  const results: TestResult[] = [];
  for (const t of tests) {
    const r = await t(supabase, ORLA);
    results.push(r);
    printResult(r);
  }

  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  const colour = passed === total ? green : red;
  console.log('');
  console.log(colour(bold(`${passed}/${total} passed`)));

  // TODO (part 2): /confirm HTTP round-trip tests (k-p).
  // Will POST to `${BASE_URL}/api/agent-intelligence/confirm` using drafts
  // captured from the skill runs above, then clean up any inserted rows.
  console.log(dim('Note: /confirm HTTP tests (k-p) will be added in part 2.'));

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error(red('Fatal:'), err);
  process.exit(2);
});
