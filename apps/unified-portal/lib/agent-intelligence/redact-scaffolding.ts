/**
 * Strip internal model-facing scaffolding from text shown to the user.
 *
 * Background (Issue 1.1 / Chrome ISSUE-001): PR #97 added a "Next:" hint
 * inside the `get_candidate_units` envelope summary so the model would
 * follow through with `draft_buyer_followups` in the same turn. That
 * hint occasionally rendered to the user verbatim as a red error block
 * — the user saw raw tool-call syntax like
 *
 *     Next: if the user asked for drafts, immediately call
 *     draft_buyer_followups(targets=[the units above], purpose='chase',
 *     topic='[full sentence describing the reason]') in the SAME turn.
 *
 * Solution: redact the summary at the boundary where it's emitted to
 * the client (the `envelope` SSE frame). The model still sees the
 * original via the tool-result message in its context, so chain
 * orchestration is unaffected.
 *
 * Strategy:
 *   - Drop any line that begins with a known scaffolding label
 *     ("Next:", "Step 2:", "Then:") AND contains tool-call syntax.
 *   - Drop any line that contains placeholder syntax like
 *     "[full sentence describing X]".
 *   - Drop any line that contains instruction-to-model phrases like
 *     "in the SAME turn", "the input to step 2", "do not stop after",
 *     "the final answer".
 *   - Collapse multiple blank lines to one and trim trailing whitespace.
 *
 * Any line that doesn't match a redaction pattern passes through
 * untouched, so legitimate skill summaries (e.g. "Drafted 3 follow-ups
 * for buyers at Lakeside Manor") are preserved verbatim.
 */

const TOOL_CALL_RE = /\b(?:draft_buyer_followups|draft_message|draft_lease_renewal|surface_aged_contracts_for_solicitor|schedule_viewing_draft|create_viewing_schedule|get_candidate_units|rank_pipeline_buyers|query_compliance_status|natural_query|draft_viewing_followup|weekly_monday_briefing)\s*\(/i;

const SCAFFOLD_LEAD_RE = /^\s*(?:next|step\s*\d+|then|now)\s*:\s*/i;

const PLACEHOLDER_RE = /\[(?:full sentence|insert|describe|describing|placeholder|fill in)[^\]]*\]/i;

const INSTRUCTION_TO_MODEL_RE =
  /\b(?:in the same turn|input to step \d+|do not stop after|the final answer|call (?:get|draft|surface|schedule|create|rank|query)_[a-z_]+|immediately call)\b/i;

const ARG_SYNTAX_RE = /\b(?:targets|purpose|topic|recipient_type|recipient|tone|filter|document_type|intent|window_hours|threshold_days|tenancy_id|tenant_name|scheme_name|development_id|date|start_time|end_time|slot_duration_minutes|target_count|preferred_datetime|buyer_email|buyer_phone|buyer_name|recipient_name|recipient_email|context|custom_instruction|related_unit|related_scheme|related_property|unit_or_property_ref|unit_identifier|limit)\s*=\s*['"\[]/;

function isScaffoldingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (SCAFFOLD_LEAD_RE.test(trimmed) && (TOOL_CALL_RE.test(trimmed) || ARG_SYNTAX_RE.test(trimmed))) return true;
  if (PLACEHOLDER_RE.test(trimmed)) return true;
  if (INSTRUCTION_TO_MODEL_RE.test(trimmed) && (TOOL_CALL_RE.test(trimmed) || ARG_SYNTAX_RE.test(trimmed))) return true;
  // Multi-line scaffold: the "do not stop after this candidate list" phrase
  // appears on its own follow-on line in the PR-97 nudge. Catch it standalone.
  if (/^\s*do not stop after this candidate list\b/i.test(trimmed)) return true;
  return false;
}

/**
 * Redact internal scaffolding markers from a user-facing summary string.
 * Pure function — does not mutate.
 */
export function redactSummaryForUser(summary: string | null | undefined): string {
  if (!summary) return '';
  const lines = String(summary).split('\n');
  const kept = lines.filter((l) => !isScaffoldingLine(l));
  // Collapse runs of blank lines into a single blank, then trim trailing
  // whitespace. Preserves intentional paragraph breaks but drops the
  // trailing "\n\n<scaffolding>" that the redaction leaves behind.
  const collapsed: string[] = [];
  for (const line of kept) {
    const isBlank = line.trim() === '';
    const lastIsBlank = collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === '';
    if (isBlank && lastIsBlank) continue;
    collapsed.push(line);
  }
  while (collapsed.length && collapsed[collapsed.length - 1].trim() === '') collapsed.pop();
  return collapsed.join('\n').trimEnd();
}

/**
 * Apply `redactSummaryForUser` to every summary string inside an
 * envelope, including the summary fields nested under each draft's
 * `reasoning`. Returns a new envelope (does not mutate).
 *
 * The envelope shape lives in `lib/agent-intelligence/envelope.ts` but
 * importing it here would create a circular dep with the test stub, so
 * we use a structural type.
 */
export function redactEnvelopeForUser<T extends { summary?: string; drafts?: Array<{ reasoning?: string }> }>(
  envelope: T,
): T {
  return {
    ...envelope,
    summary: redactSummaryForUser(envelope.summary),
    drafts: (envelope.drafts || []).map((d) => ({
      ...d,
      // Reasoning surfaces in the drawer "Why" chip — same redaction applies.
      reasoning: d.reasoning ? redactSummaryForUser(d.reasoning) : d.reasoning,
    })) as any,
  };
}
