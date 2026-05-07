/**
 * Server-side two-step chain for buyer-chase requests.
 *
 * PR #97's live test showed that soft prompt directives (the SALES
 * TWO-STEP CHAIN block + the getCandidateUnitsSkill "Next: …" nudge in
 * the envelope summary) are unreliable: the model received the
 * candidate list with explicit "next call draft_buyer_followups"
 * instructions and stopped, treating the hint as text to display
 * rather than instruction to execute. Same lesson as cross-scheme
 * ranking — soft directives don't move the model; the chain has to
 * happen in code.
 *
 * This module is the deterministic chain. When the model calls
 * `get_candidate_units` AND the original user message carries
 * draft-intent language (draft / send / chase / follow up / email /
 * reach out / message / write to / mail / ping / contact / let X
 * know), the chat route invokes `draft_buyer_followups` in the same
 * turn with:
 *   - targets derived from the candidate list
 *   - purpose + topic derived from the candidate intent (hard-coded
 *     templates; deterministic, consistent voice)
 *
 * The model never decides whether to chain; it just summarises both
 * tool results in its final reply.
 */

import type { CandidateIntent, UnitCandidate } from './unit-resolver';
import type { DraftBuyerFollowupPurpose } from './tools/agentic-skills';

/**
 * Words and phrases in the user's message that signal "the user wants
 * drafts produced for the cohort the model is about to fetch". Errs
 * on the inclusive side — better to chain a draft the user wanted
 * than to leave a candidate-list dangling. The cost of an extra
 * chain when the user wanted only a list is low (drafts land in the
 * approval drawer, agent doesn't have to send them); the cost of a
 * missed chain is the bug we just hit in production.
 *
 * Whole-word matches only — avoids false positives on substring
 * overlaps (e.g. "discharge" shouldn't match "chase").
 */
const DRAFT_INTENT_RE =
  /\b(draft|drafts?|drafted|drafting|send|sends?|sending|sent|chase|chases|chasing|chased|follow[-\s]?up|following[-\s]?up|reach[-\s]?out|reaching[-\s]?out|email|emails?|emailing|message|messages?|messaging|write\s+to|writing\s+to|contact|contacts?|contacting|let\s+\S+\s+know|mail|mails?|mailing|ping|pings?|pinging)\b/i;

export function messageHasDraftIntent(message: string | null | undefined): boolean {
  if (!message) return false;
  return DRAFT_INTENT_RE.test(message);
}

/**
 * Map a candidate-units intent onto the draft_buyer_followups inputs
 * the server-side chain should fire with. Hard-coded sentence-form
 * topics (option (i) from the task brief) — deterministic, agent-voice
 * consistent, and always satisfies the registry parameter description's
 * "must be a complete sentence" rule.
 *
 * Returns null when the intent is too generic for an auto-chain
 * (intent='all') — in that case the model has to decide what to do.
 */
export interface ChainPlan {
  purpose: DraftBuyerFollowupPurpose;
  topic: string;
}

export function planChainFromIntent(intent: CandidateIntent): ChainPlan | null {
  switch (intent) {
    case 'mortgage_expiring':
      return {
        purpose: 'chase',
        topic:
          'I noticed your mortgage approval is coming up for expiry — happy to help arrange anything needed before it lapses.',
      };
    case 'overdue_contracts':
      return {
        purpose: 'chase',
        topic:
          'I wanted to check in on your contract signing — could you let me know where things stand?',
      };
    case 'sale_agreed':
      return {
        purpose: 'chase',
        topic:
          'Just checking in on the next steps from your sale agreement — happy to help move things along whenever you\'re ready.',
      };
    case 'handover':
      return {
        // congratulate_handover ignores topic and uses its own template body.
        purpose: 'congratulate_handover',
        topic: '',
      };
    case 'all':
    default:
      // Too generic — the user probably asked for something specific
      // that the model resolved to 'all' as a fallback. Don't auto-chain
      // because we can't pick a sensible topic.
      return null;
  }
}

/**
 * Build the targets array that goes into draft_buyer_followups from a
 * candidate-units result. One entry per unit; joint purchasers at one
 * unit collapse to a single target inside draft_buyer_followups.
 */
export function buildChainTargets(
  candidates: UnitCandidate[],
): Array<{ unit_identifier: string; scheme_name: string }> {
  return candidates.map((c) => ({
    unit_identifier: c.unit_number,
    scheme_name: c.scheme_name,
  }));
}

/**
 * Decide whether the chain should fire for this turn.
 *
 * Conditions (all must hold):
 *   1. The model just called `get_candidate_units` and it returned
 *      a non-empty candidates array.
 *   2. The intent is one we have a chain plan for (handover,
 *      overdue_contracts, mortgage_expiring, sale_agreed).
 *   3. The user's original message contains draft-intent language.
 *
 * Returns the chain plan + targets when all three hold; null
 * otherwise (model + chat layer fall through to normal rendering).
 */
export function shouldChainAfterCandidateUnits(args: {
  toolName: string;
  intent: CandidateIntent | null;
  candidates: UnitCandidate[];
  userMessage: string;
}): { plan: ChainPlan; targets: Array<{ unit_identifier: string; scheme_name: string }> } | null {
  if (args.toolName !== 'get_candidate_units') return null;
  if (!args.candidates.length) return null;
  if (!args.intent) return null;
  if (!messageHasDraftIntent(args.userMessage)) return null;
  const plan = planChainFromIntent(args.intent);
  if (!plan) return null;
  return { plan, targets: buildChainTargets(args.candidates) };
}
