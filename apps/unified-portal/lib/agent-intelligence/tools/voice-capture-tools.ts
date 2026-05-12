/**
 * Post-viewing voice capture loop.
 *
 * One short utterance ("viewing went well, she's worried about heating bills,
 * follow up Friday morning") fans out into multiple structured actions:
 *   1) `extractPostViewingActions` — single OpenAI call that converts the
 *      transcript into an outcome + notes + next_actions + suggested follow-up
 *      draft. Conservative: NEVER invents data the agent didn't say.
 *   2) `executePostViewingCapture` — orchestrator that auto-saves the silent
 *      actions (status, notes, reminders, audit log) and persists the
 *      follow-up email to `pending_drafts` for agent approval. Partial
 *      failures are returned honestly so the UI can show what landed and
 *      what didn't.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentContext } from '../types';
import {
  confirmMarkStatus,
  resolveViewingReference,
  type ResolvedViewing,
  type ViewingSource,
  type MarkStatus,
} from './viewing-tools';
import { formatViewingTime, DEFAULT_TZ } from '../viewing-resolver';

export type PostViewingOutcome =
  | 'high_interest'
  | 'mild_interest'
  | 'no_interest'
  | 'callback_needed'
  | 'viewing_didnt_happen';

export type NoteCategory = 'concern' | 'question' | 'next_step' | 'general';

export interface StructuredNote {
  category: NoteCategory;
  content: string;
}

export type NextActionType =
  | 'follow_up_email'
  | 'send_information'
  | 'schedule_callback'
  | 'mark_no_show'
  | 'mark_completed';

export interface NextAction {
  type: NextActionType;
  /** Either an ISO 8601 timestamp/date or a natural-language hint, or null when none stated. */
  timing: string | null;
  details: string;
}

export interface SuggestedFollowUp {
  tone: 'warm' | 'neutral' | 'firm';
  subject: string;
  body: string;
  /** Subset of structured_notes[].content that this email references. */
  addresses_concerns: string[];
}

export type ExtractionConfidence = 'high' | 'medium' | 'low';

export interface PostViewingExtraction {
  outcome: PostViewingOutcome;
  structured_notes: StructuredNote[];
  next_actions: NextAction[];
  suggested_follow_up: SuggestedFollowUp | null;
  confidence: ExtractionConfidence;
}

export interface PostViewingContext {
  viewing_id: string;
  applicant_id: string;
  applicant_name: string;
  development_name: string;
  scheduled_at: string;
}

const POST_VIEWING_SYSTEM_PROMPT = `You are the structured-extraction layer behind a post-viewing voice capture loop for an Irish property agent CRM.

The agent has just finished a viewing. They speak for 15-90 seconds about how it went, what the applicant said, and what to do next. Your job is to convert that transcript into a structured action plan — and draft a short follow-up email in the agent's own voice.

Return ONLY valid JSON matching the schema in the user message. Never invent details the agent did not say.

OUTCOME — pick exactly one:
  - "high_interest": applicant strongly engaged, wants next step soon (second viewing, application, offer).
  - "mild_interest": polite but non-committal; reasonable to follow up.
  - "no_interest": applicant ruled the property out.
  - "callback_needed": applicant has a specific question or blocker that needs a follow-up before progressing.
  - "viewing_didnt_happen": agent reports the applicant didn't show or the viewing was cancelled in person.

STRUCTURED NOTES — one entry per distinct thing the agent mentioned. Categories:
  - "concern": something the applicant is worried about (heating bills, noise, commute).
  - "question": a question the applicant asked that the agent hasn't answered yet.
  - "next_step": something the AGENT explicitly committed to doing.
  - "general": colour the agent shared that doesn't fit the above.
Keep each content to one short sentence in the agent's voice. Reuse the agent's own wording where possible.

NEXT ACTIONS — explicit follow-ups the agent stated. ONLY emit when the agent stated it. If timing is vague ("later in the week") set timing to null and use details to capture the phrase. If timing is concrete ("Friday morning"), put a plain natural-language hint in timing — DO NOT invent a calendar date.

SUGGESTED FOLLOW-UP — a short draft email from the agent to the applicant. Required UNLESS outcome is "no_interest" or "viewing_didnt_happen" (then return null). Constraints:
  - Open with "Hi <FirstName>," — use only the applicant's actual first name. No "Dear", no "Hello".
  - End with "Cheers," on its own line then the agent's first name on the next line.
  - Body: 2-4 short paragraphs, peer-to-peer Irish English. One professional talking to another.
  - Reference the specific concerns/questions the agent captured. Never invent details (no quoting prices, BER numbers, dates, dimensions the agent didn't mention).
  - BANNED PHRASES: "I hope this finds you well", "I trust you're well", "I wanted to reach out", "I'm reaching out", "thank you for your time today" (overused), em dashes, "yet from here", any AI filler.
  - No emoji. No markdown. No exclamation marks unless the transcript itself contained one.
  - subject: one short clause referring to the viewing or the property (e.g. "Following up on your viewing at Lakeside Manor").
  - addresses_concerns: copy the exact content strings from structured_notes whose substance is reflected in the email body.

CONFIDENCE:
  - "high": transcript was clear, outcome obvious, next steps clean.
  - "medium": some ambiguity but you could reasonably extract a plan.
  - "low": transcript was short, unclear, or contradictory. Default to "low" if the transcript is under 8 words or the outcome is genuinely unclear from what was said.

ANTI-INVENTION RULES (non-negotiable):
  - If the agent did not mention a date, leave timing null.
  - If the agent did not mention a price, dimension, BER rating, deposit, or any specific fact, DO NOT include it in the email.
  - If the agent did not mention a partner / co-applicant, do not infer one.
  - If the agent's wording is contradictory, set confidence="low" and pick the most cautious interpretation (mild_interest over high_interest).`;

interface BuildUserPromptArgs {
  transcript: string;
  context: PostViewingContext;
  agentDisplayName: string;
}

function buildUserPrompt({ transcript, context, agentDisplayName }: BuildUserPromptArgs): string {
  const firstName = context.applicant_name.split(/\s+/)[0] || context.applicant_name;
  const agentFirstName = agentDisplayName.split(/\s+/)[0] || agentDisplayName;
  const when = (() => {
    try {
      return formatViewingTime(context.scheduled_at, DEFAULT_TZ);
    } catch {
      return context.scheduled_at;
    }
  })();
  return `VIEWING CONTEXT:
- applicant_name: ${context.applicant_name}
- applicant_first_name: ${firstName}
- development_name: ${context.development_name}
- scheduled_at: ${when}
- agent_display_name: ${agentDisplayName}
- agent_first_name: ${agentFirstName}

TRANSCRIPT (verbatim, from a voice recording — may contain Irish spoken English and minor recognition slips):
"""
${transcript}
"""

Return JSON of shape:
{
  "outcome": "high_interest" | "mild_interest" | "no_interest" | "callback_needed" | "viewing_didnt_happen",
  "structured_notes": [
    { "category": "concern" | "question" | "next_step" | "general", "content": string }
  ],
  "next_actions": [
    {
      "type": "follow_up_email" | "send_information" | "schedule_callback" | "mark_no_show" | "mark_completed",
      "timing": string | null,
      "details": string
    }
  ],
  "suggested_follow_up": {
    "tone": "warm" | "neutral" | "firm",
    "subject": string,
    "body": string,
    "addresses_concerns": string[]
  } | null,
  "confidence": "high" | "medium" | "low"
}`;
}

const BANNED_FRAGMENTS = [
  'i hope this finds you well',
  'i trust you',
  'i wanted to reach out',
  "i'm reaching out",
  'reaching out to',
  'thank you for your time today',
  'thank you for taking the time',
  'thank you for taking time',
  'as discussed',
  'please let me know if',
  'feel free to',
  'happy to help',
];

/**
 * Defence-in-depth scrub. The LLM is told not to use AI filler / em dashes;
 * if it slips through, we strip the most obvious offences server-side so we
 * never put a "I hope this finds you well" line in front of a real Irish
 * applicant.
 *
 * Returns the cleaned body. Conservative — only rewrites when the line is
 * clearly boilerplate; never edits substantive content.
 */
export function scrubFollowUpBody(body: string): string {
  if (!body) return '';
  // Em dashes → simple comma + space. Same for en dashes.
  let out = body.replace(/—/g, ', ').replace(/–/g, '-');
  // Drop lines that are pure filler.
  const lines = out.split(/\n/);
  const kept: string[] = [];
  for (const raw of lines) {
    const lower = raw.toLowerCase().trim();
    if (lower.length === 0) {
      kept.push(raw);
      continue;
    }
    const isPureFiller =
      BANNED_FRAGMENTS.some((f) => lower.startsWith(f)) &&
      lower.length < 90; // long lines often contain real content too
    if (isPureFiller) continue;
    kept.push(raw);
  }
  out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

function isValidOutcome(value: unknown): value is PostViewingOutcome {
  return (
    value === 'high_interest' ||
    value === 'mild_interest' ||
    value === 'no_interest' ||
    value === 'callback_needed' ||
    value === 'viewing_didnt_happen'
  );
}

function isValidNoteCategory(value: unknown): value is NoteCategory {
  return value === 'concern' || value === 'question' || value === 'next_step' || value === 'general';
}

function isValidActionType(value: unknown): value is NextActionType {
  return (
    value === 'follow_up_email' ||
    value === 'send_information' ||
    value === 'schedule_callback' ||
    value === 'mark_no_show' ||
    value === 'mark_completed'
  );
}

function normaliseExtraction(raw: any): PostViewingExtraction {
  const outcome: PostViewingOutcome = isValidOutcome(raw?.outcome) ? raw.outcome : 'mild_interest';

  const structured_notes: StructuredNote[] = Array.isArray(raw?.structured_notes)
    ? raw.structured_notes
        .map((n: any) => ({
          category: isValidNoteCategory(n?.category) ? n.category : 'general',
          content: typeof n?.content === 'string' ? n.content.trim() : '',
        }))
        .filter((n: StructuredNote) => n.content.length > 0)
    : [];

  const next_actions: NextAction[] = Array.isArray(raw?.next_actions)
    ? raw.next_actions
        .map((a: any) => ({
          type: isValidActionType(a?.type) ? a.type : 'follow_up_email',
          timing: typeof a?.timing === 'string' && a.timing.trim().length > 0 ? a.timing.trim() : null,
          details: typeof a?.details === 'string' ? a.details.trim() : '',
        }))
        .filter((a: NextAction) => a.details.length > 0)
    : [];

  let suggested_follow_up: SuggestedFollowUp | null = null;
  if (raw?.suggested_follow_up && typeof raw.suggested_follow_up === 'object') {
    const sf = raw.suggested_follow_up;
    const tone: SuggestedFollowUp['tone'] =
      sf.tone === 'warm' || sf.tone === 'neutral' || sf.tone === 'firm' ? sf.tone : 'warm';
    const subject = typeof sf.subject === 'string' ? sf.subject.trim() : '';
    const body = typeof sf.body === 'string' ? scrubFollowUpBody(sf.body) : '';
    const addresses_concerns = Array.isArray(sf.addresses_concerns)
      ? sf.addresses_concerns.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
      : [];
    if (subject.length > 0 && body.length > 0) {
      suggested_follow_up = { tone, subject, body, addresses_concerns };
    }
  }

  // Outcomes that aren't follow-up-eligible suppress the draft.
  if (outcome === 'no_interest' || outcome === 'viewing_didnt_happen') {
    suggested_follow_up = null;
  }

  const confidence: ExtractionConfidence =
    raw?.confidence === 'high' || raw?.confidence === 'medium' || raw?.confidence === 'low'
      ? raw.confidence
      : 'medium';

  return {
    outcome,
    structured_notes,
    next_actions,
    suggested_follow_up,
    confidence,
  };
}

function downgradeIfTranscriptUnclear(
  transcript: string,
  extraction: PostViewingExtraction,
): PostViewingExtraction {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length < 8) {
    return { ...extraction, confidence: 'low' };
  }
  return extraction;
}

export interface ExtractOptions {
  /** Override the OpenAI model. Default gpt-4o-mini. */
  model?: string;
  agentDisplayName?: string;
  /** Test seam — pass a stub OpenAI client. */
  client?: OpenAI;
}

export async function extractPostViewingActions(
  transcript: string,
  viewingContext: PostViewingContext,
  options: ExtractOptions = {},
): Promise<PostViewingExtraction> {
  const trimmed = (transcript || '').trim();
  if (!trimmed) {
    return {
      outcome: 'mild_interest',
      structured_notes: [],
      next_actions: [],
      suggested_follow_up: null,
      confidence: 'low',
    };
  }

  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = options.model ?? 'gpt-4o-mini';
  const agentDisplayName = options.agentDisplayName ?? 'the agent';

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: POST_VIEWING_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildUserPrompt({
          transcript: trimmed,
          context: viewingContext,
          agentDisplayName,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let raw: any;
  try {
    raw = JSON.parse(content);
  } catch {
    raw = {};
  }

  const normalised = normaliseExtraction(raw);
  return downgradeIfTranscriptUnclear(trimmed, normalised);
}

// =====================================================================
// Orchestration
// =====================================================================

export interface SavedActionsSummary {
  viewing_status: MarkStatus | null;
  notes_added: number;
  reminders_created: number;
  audit_log_id: string | null;
}

export interface PendingApprovalSummary {
  follow_up_email: {
    pending_draft_id: string | null;
    subject: string;
    body: string;
    tone: SuggestedFollowUp['tone'];
    addresses_concerns: string[];
  } | null;
  clarifications: string[];
}

export interface ExecuteFailure {
  step:
    | 'resolve_viewing'
    | 'extract_actions'
    | 'mark_status'
    | 'append_notes'
    | 'create_reminders'
    | 'persist_draft'
    | 'unknown';
  message: string;
}

export interface PostViewingCaptureResult {
  ok: boolean;
  transcript: string;
  confidence: ExtractionConfidence;
  outcome: PostViewingOutcome;
  saved: SavedActionsSummary;
  pending_approval: PendingApprovalSummary;
  errors: ExecuteFailure[];
  viewing: {
    viewing_id: string;
    source: ViewingSource;
    applicant_id: string | null;
    applicant_name: string;
    development_name: string | null;
    scheduled_at: string;
  };
}

function outcomeToStatus(outcome: PostViewingOutcome): MarkStatus | null {
  if (outcome === 'viewing_didnt_happen') return 'no_show';
  // Every other outcome represents a viewing that happened.
  return 'completed';
}

function buildNotesAppendBlock(
  extraction: PostViewingExtraction,
  scheduledAt: string,
): string {
  const heading = (() => {
    try {
      return `Post-viewing voice capture — ${formatViewingTime(scheduledAt, DEFAULT_TZ)}`;
    } catch {
      return 'Post-viewing voice capture';
    }
  })();
  const lines: string[] = [heading, `Outcome: ${prettyOutcome(extraction.outcome)}`];
  for (const note of extraction.structured_notes) {
    lines.push(`- ${prettyCategory(note.category)}: ${note.content}`);
  }
  if (extraction.next_actions.length > 0) {
    lines.push('Next actions:');
    for (const a of extraction.next_actions) {
      const timing = a.timing ? ` (${a.timing})` : '';
      lines.push(`- ${a.details}${timing}`);
    }
  }
  return lines.join('\n');
}

function prettyOutcome(outcome: PostViewingOutcome): string {
  switch (outcome) {
    case 'high_interest':
      return 'High interest';
    case 'mild_interest':
      return 'Mild interest';
    case 'no_interest':
      return 'No interest';
    case 'callback_needed':
      return 'Callback needed';
    case 'viewing_didnt_happen':
      return 'Viewing did not happen';
  }
}

function prettyCategory(category: NoteCategory): string {
  switch (category) {
    case 'concern':
      return 'Concern';
    case 'question':
      return 'Question';
    case 'next_step':
      return 'Next step';
    case 'general':
      return 'Note';
  }
}

/**
 * Best-effort ISO date for reminders. Accepts a few common shapes the LLM
 * might emit — explicit ISO, "Friday morning", "tomorrow at 10". Returns
 * null when ambiguous; the reminder is still created but `due_date` is left
 * null so the agent's task list still surfaces it without a fake date.
 */
function timingToIso(timing: string | null, _scheduledAt: string): string | null {
  if (!timing) return null;
  const trimmed = timing.trim();
  // Already-ISO heuristic: 2026-05-12 or 2026-05-12T...
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed.length === 10 ? `${trimmed}T09:00:00` : trimmed);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  // Bail out for natural language. The Intelligence pipeline already has a
  // natural-date parser (parseScheduledAtNatural) but it expects a time —
  // we don't want to invent a default time for vague phrases.
  return null;
}

interface ExecuteOptions extends ExtractOptions {
  /** Inject an extraction result to bypass the LLM call (tests). */
  extractionOverride?: PostViewingExtraction;
}

/**
 * Orchestrator. Pulls the viewing record, runs extraction, auto-saves the
 * silent actions, persists the follow-up draft for approval, returns an
 * envelope describing exactly what landed and what didn't.
 *
 * NEVER throws — every failure becomes an entry in `errors` so the UI can
 * show partial-success honestly. The only hard exception is a programming
 * bug (e.g. supabase client missing).
 */
export async function executePostViewingCapture(
  supabase: SupabaseClient,
  agentContext: AgentContext,
  args: { transcript: string; viewing_id: string },
  options: ExecuteOptions = {},
): Promise<PostViewingCaptureResult> {
  const errors: ExecuteFailure[] = [];

  // 1. Resolve viewing → confirm tenant ownership.
  const resolved = await resolveViewingReference(supabase, agentContext, {
    viewing_id: args.viewing_id,
  });
  if (resolved.status !== 'one') {
    return {
      ok: false,
      transcript: args.transcript,
      confidence: 'low',
      outcome: 'mild_interest',
      saved: { viewing_status: null, notes_added: 0, reminders_created: 0, audit_log_id: null },
      pending_approval: { follow_up_email: null, clarifications: [] },
      errors: [
        {
          step: 'resolve_viewing',
          message:
            resolved.status === 'none' ? resolved.message : 'Viewing could not be uniquely resolved.',
        },
      ],
      viewing: {
        viewing_id: args.viewing_id,
        source: 'viewings',
        applicant_id: null,
        applicant_name: 'Applicant',
        development_name: null,
        scheduled_at: new Date().toISOString(),
      },
    };
  }

  const viewing: ResolvedViewing = resolved.viewing;
  const viewingContext: PostViewingContext = {
    viewing_id: viewing.id,
    applicant_id: viewing.applicant_id ?? '',
    applicant_name: viewing.applicant_name,
    development_name: viewing.development_name ?? viewing.location ?? '',
    scheduled_at: viewing.scheduled_at,
  };

  // 2. Extract structured plan.
  let extraction: PostViewingExtraction;
  try {
    extraction =
      options.extractionOverride ??
      (await extractPostViewingActions(args.transcript, viewingContext, {
        model: options.model,
        agentDisplayName: agentContext.displayName,
        client: options.client,
      }));
  } catch (err) {
    return {
      ok: false,
      transcript: args.transcript,
      confidence: 'low',
      outcome: 'mild_interest',
      saved: { viewing_status: null, notes_added: 0, reminders_created: 0, audit_log_id: null },
      pending_approval: { follow_up_email: null, clarifications: [] },
      errors: [
        {
          step: 'extract_actions',
          message: err instanceof Error ? err.message : 'Extraction failed',
        },
      ],
      viewing: {
        viewing_id: viewing.id,
        source: viewing.source,
        applicant_id: viewing.applicant_id,
        applicant_name: viewing.applicant_name,
        development_name: viewing.development_name,
        scheduled_at: viewing.scheduled_at,
      },
    };
  }

  // 3. Auto-execute silent actions.
  let viewingStatus: MarkStatus | null = null;
  let auditLogId: string | null = null;
  let notesAdded = 0;
  let remindersCreated = 0;

  // 3a. Mark viewing status — only when the viewing isn't already terminal.
  const desiredStatus = outcomeToStatus(extraction.outcome);
  const alreadyMarked =
    viewing.status === 'completed' ||
    viewing.status === 'no_show' ||
    viewing.status === 'cancelled';
  if (desiredStatus && !alreadyMarked) {
    try {
      const markResult = await confirmMarkStatus(supabase, agentContext, {
        viewing_id: viewing.id,
        source: viewing.source,
        status: desiredStatus,
      });
      viewingStatus = desiredStatus;
      auditLogId = markResult.audit_log_id;
    } catch (err) {
      errors.push({
        step: 'mark_status',
        message: err instanceof Error ? err.message : 'Could not update viewing status',
      });
    }
  } else if (alreadyMarked) {
    viewingStatus = viewing.status as MarkStatus;
  }

  // 3b. Append notes to the applicant record. Skip silently if the viewing
  // has no canonical applicant_id (legacy agent_viewings rows).
  if (viewing.applicant_id && extraction.structured_notes.length > 0) {
    try {
      const block = buildNotesAppendBlock(extraction, viewing.scheduled_at);
      const { data: existing, error: readErr } = await supabase
        .from('agent_applicants')
        .select('notes')
        .eq('id', viewing.applicant_id)
        .eq('tenant_id', agentContext.tenantId)
        .maybeSingle();
      if (readErr) throw readErr;

      const prior = (existing?.notes as string | null | undefined) ?? '';
      const next = prior ? `${block}\n\n${prior}` : block;
      const { error: writeErr } = await supabase
        .from('agent_applicants')
        .update({ notes: next, updated_at: new Date().toISOString() })
        .eq('id', viewing.applicant_id)
        .eq('tenant_id', agentContext.tenantId);
      if (writeErr) throw writeErr;
      notesAdded = extraction.structured_notes.length;
    } catch (err) {
      errors.push({
        step: 'append_notes',
        message: err instanceof Error ? err.message : 'Could not save notes',
      });
    }
  }

  // 3c. Create reminders for any next_action with explicit timing. We use
  // the existing `agent_tasks` table — same source-of-truth as create_task.
  // Reminders are silent (no draft step); the agent sees them in their task
  // list.
  const remindersToCreate = extraction.next_actions.filter(
    (a) => a.timing && a.timing.trim().length > 0,
  );
  if (remindersToCreate.length > 0) {
    for (const action of remindersToCreate) {
      try {
        const dueIso = timingToIso(action.timing, viewing.scheduled_at);
        const title = (() => {
          const base = action.details.trim();
          const who = viewing.applicant_name;
          if (action.type === 'follow_up_email') return `Follow up with ${who}: ${base}`;
          if (action.type === 'send_information') return `Send to ${who}: ${base}`;
          if (action.type === 'schedule_callback') return `Call back ${who}: ${base}`;
          return base;
        })();
        const { error } = await supabase.from('agent_tasks').insert({
          agent_id: agentContext.agentProfileId,
          tenant_id: agentContext.tenantId,
          title: title.slice(0, 180),
          description: action.details,
          due_date: dueIso,
          priority: 'medium',
          related_buyer_name: viewing.applicant_name,
          related_development_id: viewing.development_id,
          source: 'intelligence',
        });
        if (error) throw error;
        remindersCreated++;
      } catch (err) {
        errors.push({
          step: 'create_reminders',
          message: err instanceof Error ? err.message : 'Could not create reminder',
        });
      }
    }
  }

  // 4. Persist follow-up email draft.
  let pendingDraftId: string | null = null;
  let pendingDraft: PendingApprovalSummary['follow_up_email'] = null;
  if (extraction.suggested_follow_up) {
    const cleanBody = scrubFollowUpBody(extraction.suggested_follow_up.body);
    const subject = extraction.suggested_follow_up.subject.trim();
    try {
      const { data, error } = await supabase
        .from('pending_drafts')
        .insert({
          user_id: agentContext.authUserId,
          tenant_id: agentContext.tenantId,
          skin: 'agent',
          draft_type: 'viewing_followup',
          recipient_id: viewing.applicant_id ?? null,
          content_json: {
            subject,
            body: cleanBody,
            skill: 'post_viewing_voice_capture',
            tone: extraction.suggested_follow_up.tone,
            addresses_concerns: extraction.suggested_follow_up.addresses_concerns,
            affected_record: {
              kind: 'viewing',
              id: viewing.id,
              label: `${viewing.applicant_name} at ${viewing.development_name ?? viewing.location ?? 'the property'}`,
            },
            reasoning: 'Drafted from post-viewing voice capture',
            provenance: [
              { id: 'voice_capture', label: 'Voice capture', detail: 'Post-viewing voice loop' },
              ...(extraction.suggested_follow_up.addresses_concerns.length > 0
                ? [
                    {
                      id: 'addresses_concerns',
                      label: 'Addresses',
                      detail: extraction.suggested_follow_up.addresses_concerns.join('; '),
                    },
                  ]
                : []),
            ],
          },
          send_method: 'email',
          status: 'pending_review',
        })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Insert returned no row');
      pendingDraftId = data.id;
      pendingDraft = {
        pending_draft_id: pendingDraftId,
        subject,
        body: cleanBody,
        tone: extraction.suggested_follow_up.tone,
        addresses_concerns: extraction.suggested_follow_up.addresses_concerns,
      };
    } catch (err) {
      errors.push({
        step: 'persist_draft',
        message: err instanceof Error ? err.message : 'Could not save follow-up draft',
      });
      // Surface the draft anyway so the UI can show what was written; just
      // signal that it didn't land in the inbox.
      pendingDraft = {
        pending_draft_id: null,
        subject,
        body: cleanBody,
        tone: extraction.suggested_follow_up.tone,
        addresses_concerns: extraction.suggested_follow_up.addresses_concerns,
      };
    }
  }

  // 5. Clarifications — surfaced when confidence is low so the UI can ask.
  const clarifications: string[] = [];
  if (extraction.confidence === 'low') {
    clarifications.push(
      'Transcript was short or unclear, double-check the outcome and notes before sending the follow-up.',
    );
  }
  if (extraction.next_actions.some((a) => !a.timing) && extraction.next_actions.length > 0) {
    const vague = extraction.next_actions
      .filter((a) => !a.timing)
      .map((a) => a.details)
      .filter((d) => d.length > 0);
    if (vague.length > 0) {
      clarifications.push(
        `When should you ${vague[0].toLowerCase()}? No specific timing was captured.`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    transcript: args.transcript,
    confidence: extraction.confidence,
    outcome: extraction.outcome,
    saved: {
      viewing_status: viewingStatus,
      notes_added: notesAdded,
      reminders_created: remindersCreated,
      audit_log_id: auditLogId,
    },
    pending_approval: {
      follow_up_email: pendingDraft,
      clarifications,
    },
    errors,
    viewing: {
      viewing_id: viewing.id,
      source: viewing.source,
      applicant_id: viewing.applicant_id,
      applicant_name: viewing.applicant_name,
      development_name: viewing.development_name,
      scheduled_at: viewing.scheduled_at,
    },
  };
}
