import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgenticSkillDraft, AgenticSkillEnvelope } from './envelope';
import type { AgentContext } from './types';

/**
 * Session 5A — single path that writes agentic-skill drafts to `pending_drafts`.
 *
 * Every agentic skill that produces drafts for the approval drawer must
 * funnel through here. One row per draft, status `pending_review`, skin
 * `agent`, `content_json` carrying subject/body/provenance chips. The helper
 * rewrites the `drafts[].id` field on the returned envelope to reference the
 * real `pending_drafts.id` so the drawer can call /send-draft and /drafts/:id
 * endpoints without any translation.
 *
 * Skills that fail to persist fall back to the original in-memory UUIDs —
 * the drawer still opens, but endpoint calls will 404. Failures are rare
 * (Supabase insert) and are logged for diagnostics.
 */

const AGENTIC_DRAFT_TYPE_BY_SKILL: Record<string, string> = {
  chase_aged_contracts: 'solicitor_chase',
  draft_viewing_followup: 'viewing_followup',
  draft_lease_renewal: 'lease_renewal',
  weekly_monday_briefing: 'weekly_briefing',
  natural_query: 'intelligence_answer',
  schedule_viewing_draft: 'schedule_viewing',
  draft_message: 'buyer_followup',
  draft_buyer_followups: 'buyer_followup',
  create_viewing_schedule: 'viewing_proposal',
};

function resolveDraftType(skill: string, draft: AgenticSkillDraft): string {
  if (draft.type === 'viewing_record') return 'viewing_record';
  if (draft.type === 'report') return AGENTIC_DRAFT_TYPE_BY_SKILL[skill] || 'intelligence_report';
  return AGENTIC_DRAFT_TYPE_BY_SKILL[skill] || 'intelligence_draft';
}

function buildProvenance(draft: AgenticSkillDraft): Array<{ id: string; label: string; detail: string | null }> {
  const chips: Array<{ id: string; label: string; detail: string | null }> = [];
  if (draft.affected_record?.label) {
    chips.push({
      id: 'affected_record',
      label: draft.affected_record.label,
      detail: draft.affected_record.kind,
    });
  }
  if (draft.reasoning) {
    chips.push({ id: 'reasoning', label: 'Why drafted', detail: draft.reasoning });
  }
  return chips;
}

function sendMethodFor(draft: AgenticSkillDraft): string {
  if (draft.type === 'email') return 'email';
  // Reports + viewing records aren't "sent" per se — track them as email so
  // the inbox shows a channel and /send-draft has a graceful default.
  return 'email';
}

export interface SkillPersistContext {
  userId: string;
  tenantId: string | null;
  skill: string;
}

/**
 * Defence-in-depth guard.
 *
 * The catch-all "recipient" sentinel previously used by draftMessageSkill
 * has been removed; the skill now returns a structured `needs_recipient`
 * envelope instead of a placeholder draft, and the contact resolver fills
 * in the email when it's on file. This set stays in place as a defensive
 * net so any future regression that re-introduces the sentinel cannot
 * land in `pending_drafts`.
 *
 * NOTE: `buyer@tbc.invalid`, `tenant@tbc.invalid`, and
 * `solicitor@tbc.invalid` are NOT blocked. Those come from flows where
 * the unit / tenancy / solicitor is resolved but the email isn't on
 * file yet — legitimate "fill in before approving" drafts.
 */
const BLOCKED_PLACEHOLDER_EMAILS = new Set([
  'recipient@tbc.invalid',
  'placeholder@tbc.invalid',
]);

function shouldBlockDraft(draft: AgenticSkillDraft): { block: boolean; reason: string } {
  const email = draft.recipient?.email ?? '';
  if (BLOCKED_PLACEHOLDER_EMAILS.has(email.toLowerCase())) {
    return {
      block: true,
      reason: `Draft blocked at persistence: recipient is placeholder "${email}". Target not resolved.`,
    };
  }
  return { block: false, reason: '' };
}

// Defence-in-depth scrub for assembled email bodies. The skill template is
// the single source of truth for greeting + sign-off, so a body should
// carry exactly one of each. If a regression slips greeting/sign-off into
// the free-text fields the skill template wraps, we end up with two of
// each. Strip a duplicated leading greeting and any duplicated trailing
// sign-off block before persisting. Conservative — only fires when the
// duplication is unambiguous (two adjacent greeting lines, or two sign-off
// lines within four lines of the tail).
const GREETING_LINE = /^\s*(hi|hello|hey|dear|good\s+(morning|afternoon|evening))\b[^\n]{0,60}[,!.]?\s*$/i;
const SIGNOFF_LINE = /^\s*(thanks|thank you|thanks so much|many thanks|best|best regards|kind regards|warm regards|warmest regards|regards|sincerely|sincerely yours|yours|yours sincerely|yours faithfully|cheers|talk soon|speak soon)\b[^\n]{0,30}[,!.]?\s*$/i;

export function dedupeBoilerplate(body: string | null | undefined): string {
  if (!body) return '';
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');

  // Leading: drop consecutive duplicate greeting lines, keep one.
  let firstGreetingIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].trim() === '') continue;
    if (GREETING_LINE.test(lines[i])) firstGreetingIdx = i;
    break;
  }
  if (firstGreetingIdx >= 0) {
    let j = firstGreetingIdx + 1;
    // Skip blank lines after the first greeting.
    while (j < lines.length && lines[j].trim() === '') j++;
    while (j < lines.length && GREETING_LINE.test(lines[j])) {
      // Remove this duplicated greeting line.
      lines.splice(j, 1);
      while (j < lines.length && lines[j].trim() === '') {
        lines.splice(j, 1);
      }
    }
  }

  // Trailing: detect repeated sign-off blocks within the last 8 lines.
  // A "sign-off block" is a sign-off line plus the 0–3 short lines that
  // follow it (name, optional title, optional company). If we find two
  // sign-off lines in the tail, drop the EARLIER one and the lines
  // between it and the later sign-off (those are the duplicate signature
  // tail of the first block).
  const tailStart = Math.max(0, lines.length - 8);
  const signoffIndices: number[] = [];
  for (let i = tailStart; i < lines.length; i++) {
    if (SIGNOFF_LINE.test(lines[i])) signoffIndices.push(i);
  }
  if (signoffIndices.length >= 2) {
    const firstSignoff = signoffIndices[0];
    const lastSignoff = signoffIndices[signoffIndices.length - 1];
    // Remove from firstSignoff up to (but not including) lastSignoff.
    lines.splice(firstSignoff, lastSignoff - firstSignoff);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function persistDraftsForEnvelope(
  supabase: SupabaseClient,
  envelope: AgenticSkillEnvelope,
  ctx: SkillPersistContext,
): Promise<AgenticSkillEnvelope> {
  if (!envelope.drafts.length) return envelope;

  const rewritten: AgenticSkillDraft[] = [];
  const blocked: Array<{ draft: AgenticSkillDraft; reason: string }> = [];

  for (const draft of envelope.drafts) {
    // Session 13.2 guard: placeholder recipient → refuse insert.
    const guard = shouldBlockDraft(draft);
    if (guard.block) {
      console.error('[persistDraftsForEnvelope] BLOCKED: placeholder recipient', {
        skill: ctx.skill,
        recipient_email: draft.recipient?.email ?? null,
        affected_record_kind: draft.affected_record?.kind ?? null,
        reason: guard.reason,
      });
      blocked.push({ draft, reason: guard.reason });
      continue;
    }

    const draftType = resolveDraftType(ctx.skill, draft);
    // Final-mile dedupe: strips duplicate greeting / sign-off blocks if the
    // template ever ends up wrapping a body that already had them.
    const cleanBody = draft.type === 'email' ? dedupeBoilerplate(draft.body) : draft.body;
    const contentJson: Record<string, any> = {
      subject: draft.subject ?? null,
      body: cleanBody,
      skill: ctx.skill,
      affected_record: draft.affected_record,
      reasoning: draft.reasoning,
      provenance: buildProvenance(draft),
    };
    if (draft.recipient) contentJson.recipient_hint = draft.recipient;

    const recipientId = draft.recipient?.email && draft.recipient.email !== 'self'
      ? draft.recipient.email
      : draft.affected_record?.id || null;

    const { data, error } = await supabase
      .from('pending_drafts')
      .insert({
        user_id: ctx.userId,
        tenant_id: ctx.tenantId,
        skin: 'agent',
        draft_type: draftType,
        recipient_id: recipientId,
        content_json: contentJson,
        send_method: sendMethodFor(draft),
        status: 'pending_review',
      })
      .select('id')
      .single();

    if (error || !data) {
      // Log but preserve the original id so the drawer still opens. The
      // draft simply won't be send/discard-able via the inbox endpoints.
      console.error('[persistDraftsForEnvelope] insert failed', { skill: ctx.skill, error: error?.message });
      rewritten.push({ ...draft, body: cleanBody });
      continue;
    }

    rewritten.push({ ...draft, id: data.id, body: cleanBody });
  }

  // Thread the blocked list through meta so the chat route can force
  // the model to surface the failure instead of claiming success.
  const existingMeta: any = (envelope.meta as any) || {};
  const existingBlocked: any[] = Array.isArray(existingMeta.blocked) ? existingMeta.blocked : [];
  const mergedBlocked = blocked.length
    ? [
        ...existingBlocked,
        ...blocked.map((b) => ({
          unit_identifier: b.draft.affected_record?.label ?? b.draft.recipient?.name ?? '',
          reason: b.reason,
        })),
      ]
    : existingBlocked;

  return {
    ...envelope,
    drafts: rewritten,
    meta: {
      ...existingMeta,
      blocked: mergedBlocked,
      record_count: rewritten.length,
    },
  };
}

/**
 * Convenience wrapper used by the tools/registry adapter. Takes a full
 * AgentContext (what the chat route already has) and resolves the skill name
 * automatically from the envelope.
 */
export async function persistSkillEnvelope(
  supabase: SupabaseClient,
  envelope: AgenticSkillEnvelope,
  agentContext: AgentContext,
): Promise<AgenticSkillEnvelope> {
  return persistDraftsForEnvelope(supabase, envelope, {
    userId: agentContext.authUserId,
    tenantId: agentContext.tenantId,
    skill: envelope.skill,
  });
}
