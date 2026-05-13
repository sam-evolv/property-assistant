/**
 * Bulk personalised applicant broadcast.
 *
 * Real letting agents and sales agents do this several times a week:
 * pick a filter ("everyone interested in Lakeside Manor"), state the
 * thing to convey ("I'm in the show house Saturday 10-2"), and the
 * platform produces N personalised drafts the agent can review.
 *
 * Pipeline is three phases inside planBroadcast:
 *   Phase 1 - LLM parses the natural-language filter into a structured
 *             filter object. Refuses to invent; returns clarification
 *             when underspecified.
 *   Phase 2 - SQL resolves the filter to a deduped list of recipients
 *             from the enquiries table within the agent's tenant.
 *   Phase 3 - LLM drafts one personalised email per recipient. Strict
 *             never-invent contract: the recipient record + the
 *             agent's stated intent are the only sources of truth.
 *
 * confirmBroadcast writes the audit row + N pending_drafts atomically
 * (audit first to obtain the broadcast_id; drafts insert with that id;
 * if drafts fail the audit is rolled back to cancelled to keep state
 * honest).
 *
 * cancelBroadcast supports a 30-minute undo window. Pending drafts not
 * yet sent are deleted; sent rows are left alone so the audit stays
 * accurate as a partial_sent record.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentContext, ToolResult } from '../types';
import { matchDevelopment, type Development } from '../property-matcher';
import { scrubFollowUpBody } from './voice-capture-tools';

export type BroadcastTone = 'warm' | 'professional' | 'urgent';

export interface BroadcastFilter {
  interested_in_scheme_ids?: string[];
  has_active_enquiry?: boolean;
  viewed_property_ids?: string[];
  last_contact_before_days?: number;
  status?: string[];
}

export interface BroadcastRecipient {
  applicant_id: string | null;
  name: string;
  email: string;
  scheme_of_interest_id: string | null;
  scheme_of_interest_name: string | null;
  last_contact_date: string | null;
}

export interface BroadcastEmailDraft {
  applicant_id: string | null;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  selected: boolean;
}

export interface BroadcastDraftEnvelope {
  status: 'draft';
  type: 'broadcast';
  intent: string;
  filter_used: BroadcastFilter;
  filter_natural: string;
  tone: BroadcastTone;
  recipients: BroadcastRecipient[];
  emails: BroadcastEmailDraft[];
  shared_signoff: string;
  message: string;
}

export type BroadcastClarificationReason =
  | 'no_intent'
  | 'no_filter'
  | 'filter_unparseable'
  | 'no_recipients_match'
  | 'too_many_recipients'
  | 'extraction_failed';

export interface BroadcastClarification {
  status: 'needs_clarification';
  reason: BroadcastClarificationReason;
  message: string;
  sample_recipients?: BroadcastRecipient[];
  recipient_count?: number;
}

export type BroadcastPlanResult = BroadcastDraftEnvelope | BroadcastClarification;

interface PlanBroadcastParams {
  intent?: string;
  filter_natural?: string;
  tone?: BroadcastTone;
}

interface PlanBroadcastOptions {
  filterModel?: string;
  emailModel?: string;
  client?: OpenAI;
  maxRecipients?: number;
}

const DEFAULT_FILTER_MODEL = 'gpt-4o-mini';
const DEFAULT_EMAIL_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_RECIPIENTS = 200;
const VALID_TONES: BroadcastTone[] = ['warm', 'professional', 'urgent'];
const UNDO_WINDOW_MS = 30 * 60 * 1000;

function normaliseTone(raw: unknown): BroadcastTone {
  if (typeof raw === 'string' && VALID_TONES.includes(raw as BroadcastTone)) {
    return raw as BroadcastTone;
  }
  return 'warm';
}

function buildSchemeContext(agentContext: AgentContext): Development[] {
  const ids = agentContext.assignedDevelopmentIds ?? [];
  const names = agentContext.assignedDevelopmentNames ?? [];
  const out: Development[] = [];
  for (let i = 0; i < ids.length; i++) {
    const name = names[i];
    if (name) out.push({ id: ids[i], name });
  }
  return out;
}

// =====================================================================
// Phase 1 - parse the natural-language filter
// =====================================================================

const FILTER_SYSTEM_PROMPT = `You convert a property agent's natural-language description of a recipient cohort into a structured filter object. The agent is Irish and may name schemes in casual English.

Return JSON of exactly this shape:
{
  "interested_in_scheme_names": string[],
  "has_active_enquiry": boolean | null,
  "viewed_property_names": string[],
  "last_contact_before_days": number | null,
  "status": string[],
  "confidence": "high" | "medium" | "low"
}

Rules:
- Only populate a field when the agent's wording clearly implies it. Otherwise leave it null or empty.
- interested_in_scheme_names: scheme names the agent mentioned, exactly as they wrote them. Use this for ANY phrasing that ties a recipient to a scheme: "interested in X", "looking at X", "enquiring about X", "viewing X", "viewed X", "who came to X". Do not normalise the scheme name. Do not invent one.
- viewed_property_names: optional, only populate when the agent specifically distinguishes "viewed" from "interested" and wants ONLY past attendees. In every other case leave this empty and rely on interested_in_scheme_names; the recipient resolver treats both as the same signal (viewings drive scheme interest in this system, applicants do not carry a separate "interested in" column).
- has_active_enquiry: true when the agent's wording implies open or unresolved enquiries ("anyone who hasn't replied yet"). null otherwise.
- last_contact_before_days: integer count of days, when the agent said something like "haven't heard from in 30 days". null otherwise.
- status: enquiry or viewing status terms the agent used verbatim ("new", "warm", "cold"). Empty array otherwise.
- confidence: "high" when the description is unambiguous, "low" when you had to guess.

NEVER invent a scheme name the agent didn't say. NEVER infer days the agent didn't state. NEVER use em dashes anywhere in your output. Return scheme names as plain strings, do not resolve them to ids; the calling layer does fuzzy matching against the agent's assigned schemes.`;

interface FilterLLMOutput {
  interested_in_scheme_names: string[];
  has_active_enquiry: boolean | null;
  viewed_property_names: string[];
  last_contact_before_days: number | null;
  status: string[];
  confidence: 'high' | 'medium' | 'low';
}

function normaliseFilterLLMOutput(raw: any): FilterLLMOutput {
  const schemes = Array.isArray(raw?.interested_in_scheme_names)
    ? raw.interested_in_scheme_names.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    : [];
  const viewed = Array.isArray(raw?.viewed_property_names)
    ? raw.viewed_property_names.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    : [];
  const statuses = Array.isArray(raw?.status)
    ? raw.status.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
    : [];
  const days =
    typeof raw?.last_contact_before_days === 'number' && Number.isFinite(raw.last_contact_before_days)
      ? Math.max(0, Math.floor(raw.last_contact_before_days))
      : null;
  const hasActive =
    typeof raw?.has_active_enquiry === 'boolean' ? raw.has_active_enquiry : null;
  const confidence =
    raw?.confidence === 'high' || raw?.confidence === 'medium' || raw?.confidence === 'low'
      ? raw.confidence
      : 'medium';
  return {
    interested_in_scheme_names: schemes,
    has_active_enquiry: hasActive,
    viewed_property_names: viewed,
    last_contact_before_days: days,
    status: statuses,
    confidence,
  };
}

async function parseFilter(
  filterNatural: string,
  agentContext: AgentContext,
  options: PlanBroadcastOptions,
): Promise<FilterLLMOutput> {
  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = options.filterModel ?? DEFAULT_FILTER_MODEL;
  const assigned = buildSchemeContext(agentContext);
  const userPrompt = `Agent's assigned schemes (context only, the agent may name any of them or none):
${assigned.map((d) => `- ${d.name}`).join('\n') || '(none assigned)'}

Filter description (verbatim from the agent):
"""
${filterNatural}
"""

Return the JSON object described in the system prompt.`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: FILTER_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });
  const content = completion.choices[0]?.message?.content ?? '{}';
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    raw = {};
  }
  return normaliseFilterLLMOutput(raw);
}

function resolveSchemeIdsFromNames(
  names: string[],
  agentContext: AgentContext,
): { ids: string[]; unresolved: string[] } {
  const assigned = buildSchemeContext(agentContext);
  const ids: string[] = [];
  const unresolved: string[] = [];
  for (const name of names) {
    const match = matchDevelopment(name, assigned);
    if (match.type === 'unique') {
      ids.push(match.development.id);
    } else {
      unresolved.push(name);
    }
  }
  return { ids: Array.from(new Set(ids)), unresolved };
}

function buildStructuredFilter(
  parsed: FilterLLMOutput,
  agentContext: AgentContext,
): { filter: BroadcastFilter; unresolved_schemes: string[]; unresolved_viewed: string[] } {
  const interested = resolveSchemeIdsFromNames(parsed.interested_in_scheme_names, agentContext);
  const viewed = resolveSchemeIdsFromNames(parsed.viewed_property_names, agentContext);
  const filter: BroadcastFilter = {};
  if (interested.ids.length > 0) filter.interested_in_scheme_ids = interested.ids;
  if (typeof parsed.has_active_enquiry === 'boolean') filter.has_active_enquiry = parsed.has_active_enquiry;
  if (viewed.ids.length > 0) filter.viewed_property_ids = viewed.ids;
  if (typeof parsed.last_contact_before_days === 'number')
    filter.last_contact_before_days = parsed.last_contact_before_days;
  if (parsed.status.length > 0) filter.status = parsed.status;
  return {
    filter,
    unresolved_schemes: interested.unresolved,
    unresolved_viewed: viewed.unresolved,
  };
}

// =====================================================================
// Phase 2 - resolve recipients from the database
// =====================================================================
//
// Bug fix history: the first implementation joined the `enquiries` table
// to determine "applicant interested in scheme X". That assumed an enquiry
// row would exist for every applicant who'd shown interest. In production
// most of the test tenant's applicants are tracked via viewings only
// (agent_applicants has no interested_in_scheme column; the linkage is
// purely viewings.development_id and the denormalised agent_viewings
// rows). That implementation shipped zero recipients on the QA prompt.
// This version joins through both viewings tables and treats "viewed X"
// and "interested in X" as the same signal.

interface CandidateRow {
  applicant_id: string | null;
  name: string;
  email: string | null;
  development_id: string | null;
  status: string | null;
}

async function fetchCanonicalViewingsCandidates(
  supabase: SupabaseClient,
  tenantId: string,
  developmentIds: string[],
): Promise<CandidateRow[]> {
  if (developmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('viewings')
    .select('applicant_id, development_id, status')
    .eq('tenant_id', tenantId)
    .in('development_id', developmentIds)
    .limit(2000);
  if (error || !Array.isArray(data) || data.length === 0) {
    if (error) console.error('[broadcast-tools] viewings query failed', { message: error.message });
    return [];
  }
  const rows = data as Array<{ applicant_id: string | null; development_id: string | null; status: string | null }>;
  const applicantIds = Array.from(
    new Set(rows.map((r) => r.applicant_id).filter((id): id is string => !!id)),
  );
  if (applicantIds.length === 0) return [];
  const { data: applicants, error: applicantErr } = await supabase
    .from('agent_applicants')
    .select('id, full_name, email')
    .eq('tenant_id', tenantId)
    .in('id', applicantIds);
  if (applicantErr || !Array.isArray(applicants)) {
    if (applicantErr) console.error('[broadcast-tools] agent_applicants enrich failed', { message: applicantErr.message });
    return [];
  }
  const byId = new Map<string, { name: string; email: string | null }>();
  for (const a of applicants as Array<{ id: string; full_name: string | null; email: string | null }>) {
    if (a.id && a.full_name) byId.set(a.id, { name: a.full_name, email: a.email });
  }
  const out: CandidateRow[] = [];
  for (const v of rows) {
    if (!v.applicant_id) continue;
    if ((v.status ?? '').trim().toLowerCase() === 'cancelled') continue;
    const ap = byId.get(v.applicant_id);
    if (!ap) continue;
    out.push({
      applicant_id: v.applicant_id,
      name: ap.name,
      email: ap.email,
      development_id: v.development_id,
      status: v.status,
    });
  }
  return out;
}

async function fetchDenormalisedViewingsCandidates(
  supabase: SupabaseClient,
  tenantId: string,
  developmentIds: string[],
): Promise<CandidateRow[]> {
  if (developmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('agent_viewings')
    .select('buyer_name, buyer_email, development_id, status')
    .eq('tenant_id', tenantId)
    .in('development_id', developmentIds)
    .limit(2000);
  if (error || !Array.isArray(data)) {
    if (error) console.error('[broadcast-tools] agent_viewings query failed', { message: error.message });
    return [];
  }
  const out: CandidateRow[] = [];
  for (const v of data as Array<{ buyer_name: string | null; buyer_email: string | null; development_id: string | null; status: string | null }>) {
    const name = (v.buyer_name || '').trim();
    if (!name) continue;
    if ((v.status ?? '').trim().toLowerCase() === 'cancelled') continue;
    out.push({
      applicant_id: null,
      name,
      email: (v.buyer_email || '').trim() || null,
      development_id: v.development_id,
      status: v.status,
    });
  }
  return out;
}

function dedupeCandidates(
  rows: CandidateRow[],
  schemeNameById: Map<string, string>,
): BroadcastRecipient[] {
  const byKey = new Map<string, BroadcastRecipient>();
  for (const row of rows) {
    const email = (row.email || '').trim().toLowerCase();
    const name = row.name.trim();
    if (!name) continue;
    // Dedupe key: lowercased email if present (the canonical identifier),
    // otherwise the lowercased name as a fallback so a single person
    // viewing twice in agent_viewings doesn't appear twice.
    const key = email || `name:${name.toLowerCase()}`;
    const schemeId = row.development_id || null;
    const schemeName = schemeId ? schemeNameById.get(schemeId) || null : null;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        applicant_id: row.applicant_id,
        name,
        email,
        scheme_of_interest_id: schemeId,
        scheme_of_interest_name: schemeName,
        last_contact_date: null,
      });
      continue;
    }
    if (!existing.applicant_id && row.applicant_id) existing.applicant_id = row.applicant_id;
    if (!existing.email && email) existing.email = email;
    if (!existing.scheme_of_interest_id && schemeId) {
      existing.scheme_of_interest_id = schemeId;
      existing.scheme_of_interest_name = schemeName;
    }
  }
  // Recipients without an email cannot receive a broadcast. The card has
  // no inline-edit affordance for missing addresses in v1, so we drop
  // them silently here. The clarification message tells the agent if
  // every candidate fell out for this reason.
  return Array.from(byKey.values())
    .filter((r) => r.email.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function resolveRecipients(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  filter: BroadcastFilter,
): Promise<BroadcastRecipient[]> {
  const tenantId = agentContext.tenantId;
  const assignedIds = new Set(agentContext.assignedDevelopmentIds ?? []);

  // Scope set: filter.interested_in_scheme_ids when supplied, otherwise
  // the agent's full assigned-developments list. We never search across
  // every tenant scheme; that would broadcast outside the agent's
  // visible portfolio.
  const explicitSchemeIds = filter.interested_in_scheme_ids ?? [];
  const viewedSchemeIds = filter.viewed_property_ids ?? [];
  const schemeIds = new Set<string>([...explicitSchemeIds, ...viewedSchemeIds]);
  const developmentIds = schemeIds.size > 0 ? Array.from(schemeIds) : Array.from(assignedIds);
  if (developmentIds.length === 0) return [];

  const [canonical, denormalised] = await Promise.all([
    fetchCanonicalViewingsCandidates(supabase, tenantId, developmentIds),
    fetchDenormalisedViewingsCandidates(supabase, tenantId, developmentIds),
  ]);

  const schemeNameById = new Map<string, string>();
  const ids = agentContext.assignedDevelopmentIds ?? [];
  const names = agentContext.assignedDevelopmentNames ?? [];
  for (let i = 0; i < ids.length; i++) {
    if (names[i]) schemeNameById.set(ids[i], names[i]);
  }

  return dedupeCandidates([...canonical, ...denormalised], schemeNameById);
}

async function sampleTenantRecipients(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  limit = 5,
): Promise<BroadcastRecipient[]> {
  // Use agent_viewings as the sample source because it carries
  // buyer_email and buyer_name inline, so a sample never returns
  // anonymous "no email on file" rows. The agent uses this list to
  // sanity-check that their filter is just too narrow rather than
  // their tenant being empty.
  const { data } = await supabase
    .from('agent_viewings')
    .select('buyer_name, buyer_email, development_id')
    .eq('tenant_id', agentContext.tenantId)
    .not('buyer_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * 4, 20));
  const schemeNameById = new Map<string, string>();
  const ids = agentContext.assignedDevelopmentIds ?? [];
  const names = agentContext.assignedDevelopmentNames ?? [];
  for (let i = 0; i < ids.length; i++) {
    if (names[i]) schemeNameById.set(ids[i], names[i]);
  }
  const rows = ((data as Array<{ buyer_name: string | null; buyer_email: string | null; development_id: string | null }> | null) ?? []).map((r) => ({
    applicant_id: null,
    name: (r.buyer_name || '').trim(),
    email: (r.buyer_email || '').trim() || null,
    development_id: r.development_id,
    status: null,
  })) as CandidateRow[];
  return dedupeCandidates(rows, schemeNameById).slice(0, limit);
}

// =====================================================================
// Phase 3 - draft personalised emails
// =====================================================================

const EMAIL_SYSTEM_PROMPT = `You are drafting bulk personalised emails on behalf of an Irish property agent. The agent will review each draft before anything is sent.

Tone is set per call (warm / professional / urgent). Voice is Irish, peer-to-peer, one professional talking to another. Plain English.

The shared message intent is supplied verbatim in the user message. Convey that intent in each email. Open with a short personalised line that references why this specific recipient is hearing from you (their interest in a named scheme, their recent enquiry, etc), then state the shared intent in your own words, then a clear next step or invitation to reply.

HARD RULES (non-negotiable):
- NEVER invent details about a recipient that are not in their record. If their record shows scheme_of_interest_name = "<scheme name>", you may reference that scheme; if it is null, do not invent one.
- NEVER use em dashes anywhere. Use a comma or a sentence break.
- NEVER use the phrases "I hope this finds you well", "I trust you are well", "I wanted to reach out", "I'm reaching out", "thank you for your time today", or any AI filler.
- NEVER add emoji or markdown. No bold, no asterisks, no bullets.
- Maximum six lines in the body. Short paragraphs. One blank line between paragraphs.
- Open with "Hi <FirstName>," using only the recipient's actual first name (the part before the first space in their name).
- End with the tone-appropriate sign-off on its own line, then the agent's name on the next line. For warm use "Cheers,". For professional use "Best,". For urgent use "Thanks,".
- subject is one short clause referencing the property or the substance of the message. No clickbait, no exclamation marks.

Output JSON of exactly this shape:
{
  "emails": [
    { "recipient_index": number, "subject": string, "body": string }
  ]
}

There must be exactly one entry per recipient in the input array, identified by recipient_index (0-based, in the order given). If you cannot draft for a recipient (e.g. their record has nothing personalisable AND the intent is too vague), still emit a clean generic-but-honest email - never skip.`;

interface EmailLLMOutput {
  emails: Array<{ recipient_index: number; subject: string; body: string }>;
}

interface DraftEmailsArgs {
  intent: string;
  tone: BroadcastTone;
  recipients: BroadcastRecipient[];
  agentDisplayName: string;
}

async function draftEmails(
  args: DraftEmailsArgs,
  options: PlanBroadcastOptions,
): Promise<BroadcastEmailDraft[]> {
  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = options.emailModel ?? DEFAULT_EMAIL_MODEL;
  const agentFirstName = args.agentDisplayName.split(/\s+/)[0] || args.agentDisplayName;

  const recipientPayload = args.recipients.map((r, idx) => ({
    recipient_index: idx,
    name: r.name,
    first_name: r.name.split(/\s+/)[0] || r.name,
    email: r.email,
    scheme_of_interest_name: r.scheme_of_interest_name,
    last_contact_date: r.last_contact_date,
  }));

  const userPrompt = `Tone: ${args.tone}
Agent first name (for the sign-off): ${agentFirstName}

Shared message intent (verbatim from the agent, convey this in each email without parroting word-for-word):
"""
${args.intent}
"""

Recipients (${recipientPayload.length}):
${JSON.stringify(recipientPayload, null, 2)}

Return the JSON object described in the system prompt.`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EMAIL_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });
  const content = completion.choices[0]?.message?.content ?? '{}';
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    raw = {};
  }

  const llmEmails: EmailLLMOutput['emails'] = Array.isArray(raw?.emails) ? raw.emails : [];
  const byIndex = new Map<number, { subject: string; body: string }>();
  for (const e of llmEmails) {
    if (
      typeof e?.recipient_index === 'number' &&
      typeof e?.subject === 'string' &&
      typeof e?.body === 'string'
    ) {
      byIndex.set(e.recipient_index, {
        subject: e.subject.trim(),
        body: scrubFollowUpBody(e.body),
      });
    }
  }

  const out: BroadcastEmailDraft[] = [];
  for (let i = 0; i < args.recipients.length; i++) {
    const r = args.recipients[i];
    const draft = byIndex.get(i);
    out.push({
      applicant_id: r.applicant_id,
      recipient_email: r.email,
      recipient_name: r.name,
      subject: draft?.subject ?? '',
      body: draft?.body ?? '',
      selected: true,
    });
  }
  return out;
}

// =====================================================================
// planBroadcast - the public entry point
// =====================================================================

export async function planBroadcast(
  supabase: SupabaseClient,
  _tenantId: string,
  agentContext: AgentContext,
  params: PlanBroadcastParams,
  options: PlanBroadcastOptions = {},
): Promise<ToolResult> {
  const intent = (params.intent || '').trim();
  const filterNatural = (params.filter_natural || '').trim();
  const tone = normaliseTone(params.tone);

  if (!intent) {
    const message = 'Tell me what the email should say. Even a one-liner is enough.';
    const result: BroadcastClarification = { status: 'needs_clarification', reason: 'no_intent', message };
    return { data: result, summary: message };
  }
  if (!filterNatural) {
    const message = 'Tell me who the email is for. For example, "everyone interested in Lakeside Manor".';
    const result: BroadcastClarification = { status: 'needs_clarification', reason: 'no_filter', message };
    return { data: result, summary: message };
  }

  let parsedFilter: FilterLLMOutput;
  try {
    parsedFilter = await parseFilter(filterNatural, agentContext, options);
  } catch (err) {
    const message = 'I could not parse that filter. Try naming the scheme or describing the cohort plainly.';
    console.error('[broadcast-tools] filter parse failed', err);
    const result: BroadcastClarification = {
      status: 'needs_clarification',
      reason: 'filter_unparseable',
      message,
    };
    return { data: result, summary: message };
  }

  const { filter, unresolved_schemes } = buildStructuredFilter(parsedFilter, agentContext);

  // When the user named a scheme that didn't match any assigned development,
  // surface that clearly. Avoid silently dropping the filter and broadcasting
  // to a wider cohort than the user asked for.
  if (
    parsedFilter.interested_in_scheme_names.length > 0 &&
    (!filter.interested_in_scheme_ids || filter.interested_in_scheme_ids.length === 0)
  ) {
    const assignedNames = (agentContext.assignedDevelopmentNames ?? []).join(', ') || '(none)';
    const message = `I could not match "${unresolved_schemes.join(', ')}" to any of your assigned schemes. Your schemes are: ${assignedNames}. Which one did you mean?`;
    const result: BroadcastClarification = {
      status: 'needs_clarification',
      reason: 'filter_unparseable',
      message,
    };
    return { data: result, summary: message };
  }

  const maxRecipients = options.maxRecipients ?? DEFAULT_MAX_RECIPIENTS;
  const recipients = await resolveRecipients(supabase, agentContext, filter);

  if (recipients.length === 0) {
    const sample = await sampleTenantRecipients(supabase, agentContext, 5);
    const sampleNames = sample.map((s) => s.name).join(', ');
    const message =
      sample.length > 0
        ? `No applicants match that filter. Recent contacts on your books include ${sampleNames}. Either narrow the filter, try a different phrasing (for example "everyone who viewed Lakeside Manor" instead of "everyone interested in Lakeside Manor"), or pick named recipients with draft_message.`
        : 'No applicants match that filter, and your tenant has no recent viewings on file. Try a different scheme or check the contact records before broadcasting.';
    const result: BroadcastClarification = {
      status: 'needs_clarification',
      reason: 'no_recipients_match',
      message,
      sample_recipients: sample,
      recipient_count: 0,
    };
    return { data: result, summary: message };
  }

  if (recipients.length > maxRecipients) {
    const message = `${recipients.length} applicants match that filter, which is more than I send in one broadcast (cap is ${maxRecipients}). Narrow the filter further, for example by scheme, last contact, or enquiry status.`;
    const result: BroadcastClarification = {
      status: 'needs_clarification',
      reason: 'too_many_recipients',
      message,
      recipient_count: recipients.length,
    };
    return { data: result, summary: message };
  }

  let emails: BroadcastEmailDraft[];
  try {
    emails = await draftEmails(
      {
        intent,
        tone,
        recipients,
        agentDisplayName: agentContext.displayName,
      },
      options,
    );
  } catch (err) {
    const message = 'I could not draft the emails. Try again, or rephrase the intent.';
    console.error('[broadcast-tools] email drafting failed', err);
    const result: BroadcastClarification = {
      status: 'needs_clarification',
      reason: 'extraction_failed',
      message,
    };
    return { data: result, summary: message };
  }

  const signoff = buildSignoff(agentContext);
  const envelope: BroadcastDraftEnvelope = {
    status: 'draft',
    type: 'broadcast',
    intent,
    filter_used: filter,
    filter_natural: filterNatural,
    tone,
    recipients,
    emails,
    shared_signoff: signoff,
    message: `Draft ${emails.length} email${emails.length === 1 ? '' : 's'} for review`,
  };
  return { data: envelope, summary: envelope.message };
}

function buildSignoff(agentContext: AgentContext): string {
  const name = agentContext.displayName.trim();
  const agency = (agentContext.agencyName ?? '').trim();
  return agency ? `${name}, ${agency}` : name;
}

// =====================================================================
// confirmBroadcast - persist audit + N drafts atomically
// =====================================================================

export interface ConfirmBroadcastInput {
  intent: string;
  filter_used: BroadcastFilter;
  filter_natural: string;
  tone: BroadcastTone;
  emails: Array<{
    applicant_id: string | null;
    recipient_email: string;
    recipient_name: string;
    subject: string;
    body: string;
  }>;
}

export interface ConfirmBroadcastResult {
  status: 'success' | 'error';
  broadcast_id: string | null;
  drafts_written: number;
  error: string | null;
}

export async function confirmBroadcast(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  input: ConfirmBroadcastInput,
): Promise<ConfirmBroadcastResult> {
  if (input.emails.length === 0) {
    return {
      status: 'error',
      broadcast_id: null,
      drafts_written: 0,
      error: 'No recipients selected for the broadcast.',
    };
  }

  const { data: auditRow, error: auditError } = await supabase
    .from('broadcast_audit_log')
    .insert({
      tenant_id: agentContext.tenantId,
      agent_id: agentContext.authUserId,
      intent: input.intent,
      filter_used: input.filter_used,
      recipient_count: input.emails.length,
      status: 'drafted',
    })
    .select('id')
    .single();

  if (auditError || !auditRow) {
    console.error('[broadcast-tools] audit insert failed', { message: auditError?.message });
    return {
      status: 'error',
      broadcast_id: null,
      drafts_written: 0,
      error: auditError?.message ?? 'Could not record broadcast audit row.',
    };
  }

  const broadcastId = auditRow.id as string;
  const draftRows = input.emails.map((e) => ({
    user_id: agentContext.authUserId,
    tenant_id: agentContext.tenantId,
    skin: 'agent',
    draft_type: 'broadcast_email',
    recipient_id: e.applicant_id ?? null,
    content_json: {
      subject: e.subject,
      body: e.body,
      to_email: e.recipient_email,
      to_name: e.recipient_name,
      tone: input.tone,
      filter_natural: input.filter_natural,
      skill: 'broadcast_to_applicants',
      reasoning: 'Drafted from bulk applicant broadcast',
      provenance: [
        { id: 'broadcast', label: 'Broadcast', detail: `Cohort: ${input.filter_natural}` },
      ],
    },
    send_method: 'email',
    status: 'pending_review',
    broadcast_id: broadcastId,
  }));

  const { error: draftError, data: draftData } = await supabase
    .from('pending_drafts')
    .insert(draftRows)
    .select('id');

  const written = Array.isArray(draftData) ? draftData.length : 0;

  if (draftError || written !== input.emails.length) {
    // Roll the audit row back to cancelled so the receipt cannot lie about
    // partial writes. The pending_drafts rows that did land carry the same
    // broadcast_id and will be cleaned up by the rollback delete below.
    await supabase
      .from('pending_drafts')
      .delete()
      .eq('broadcast_id', broadcastId)
      .eq('status', 'pending_review');
    await supabase
      .from('broadcast_audit_log')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', broadcastId);

    console.error('[broadcast-tools] draft insert failed', {
      message: draftError?.message,
      expected: input.emails.length,
      written,
    });
    return {
      status: 'error',
      broadcast_id: broadcastId,
      drafts_written: 0,
      error:
        draftError?.message ??
        `Only ${written} of ${input.emails.length} drafts landed. Broadcast rolled back.`,
    };
  }

  return {
    status: 'success',
    broadcast_id: broadcastId,
    drafts_written: written,
    error: null,
  };
}

// =====================================================================
// cancelBroadcast - 30-minute undo window
// =====================================================================

export interface CancelBroadcastInput {
  audit_log_id: string;
}

export interface CancelBroadcastResult {
  status: 'success' | 'error' | 'expired' | 'already_cancelled' | 'not_found';
  drafts_deleted: number;
  error: string | null;
}

export async function cancelBroadcast(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  input: CancelBroadcastInput,
): Promise<CancelBroadcastResult> {
  const { data: audit, error: readError } = await supabase
    .from('broadcast_audit_log')
    .select('id, tenant_id, agent_id, status, created_at')
    .eq('id', input.audit_log_id)
    .maybeSingle();

  if (readError) {
    return { status: 'error', drafts_deleted: 0, error: readError.message };
  }
  if (!audit) {
    return { status: 'not_found', drafts_deleted: 0, error: 'Broadcast not found.' };
  }
  if (audit.tenant_id !== agentContext.tenantId || audit.agent_id !== agentContext.authUserId) {
    return { status: 'not_found', drafts_deleted: 0, error: 'Broadcast not found.' };
  }
  if (audit.status === 'cancelled') {
    return { status: 'already_cancelled', drafts_deleted: 0, error: null };
  }

  const createdAt = new Date(audit.created_at as string).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > UNDO_WINDOW_MS) {
    return {
      status: 'expired',
      drafts_deleted: 0,
      error: 'The 30-minute undo window has passed. Cancel each remaining draft from the Drafts tab.',
    };
  }

  const { data: deletedDrafts, error: deleteError } = await supabase
    .from('pending_drafts')
    .delete()
    .eq('broadcast_id', audit.id)
    .eq('status', 'pending_review')
    .select('id');

  if (deleteError) {
    return { status: 'error', drafts_deleted: 0, error: deleteError.message };
  }

  const { error: updateError } = await supabase
    .from('broadcast_audit_log')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', audit.id);

  if (updateError) {
    return {
      status: 'error',
      drafts_deleted: Array.isArray(deletedDrafts) ? deletedDrafts.length : 0,
      error: updateError.message,
    };
  }

  return {
    status: 'success',
    drafts_deleted: Array.isArray(deletedDrafts) ? deletedDrafts.length : 0,
    error: null,
  };
}

// =====================================================================
// broadcastHistory - last N rows for the agent
// =====================================================================

export interface BroadcastHistoryRow {
  id: string;
  intent: string;
  filter_used: BroadcastFilter;
  recipient_count: number;
  status: string;
  sent_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export async function listBroadcastHistory(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  limit = 20,
): Promise<BroadcastHistoryRow[]> {
  const { data, error } = await supabase
    .from('broadcast_audit_log')
    .select('id, intent, filter_used, recipient_count, status, sent_at, cancelled_at, created_at')
    .eq('agent_id', agentContext.authUserId)
    .eq('tenant_id', agentContext.tenantId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error || !Array.isArray(data)) return [];
  return data as BroadcastHistoryRow[];
}
