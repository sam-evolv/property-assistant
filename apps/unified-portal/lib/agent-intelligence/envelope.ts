/**
 * Session 5A — agentic skill envelope types.
 *
 * Every Intelligence chat tool that produces drafts returns one of these. The
 * chat SSE route emits it verbatim as an `event: envelope` frame; both the
 * mobile and desktop Intelligence pages listen and hand it to the drawer store.
 *
 * The envelope is the link between the model's tool output and the approval
 * drawer. Every draft in `drafts[]` references a real `pending_drafts.id` —
 * persistence happened inside the skill BEFORE the envelope was returned. If
 * the drawer is dismissed without action, the drafts stay in the inbox.
 */

export type AgenticDraftType = 'email' | 'viewing_record' | 'report';

export interface AgenticSkillDraft {
  /**
   * The real `pending_drafts.id`. The drawer passes this id to
   * /api/agent/intelligence/send-draft and /api/agent/intelligence/drafts/:id.
   */
  id: string;
  type: AgenticDraftType;
  recipient?: { name: string; email: string; role?: string };
  subject?: string;
  body: string;
  affected_record: { kind: string; id: string; label: string };
  reasoning: string;
}

export interface AgenticSkillEnvelope {
  skill: string;
  status: 'awaiting_approval';
  summary: string;
  drafts: AgenticSkillDraft[];
  meta: { record_count: number; generated_at: string; query: string };
  /**
   * Optional coverage tag, mirrors the field on ToolResult. The
   * `runAgenticSkill` adapter copies it onto the ToolResult so the system
   * prompt's TOOL RESULT INTERPRETATION rules apply uniformly to read tools
   * and agentic skills. Unset is interpreted as 'ok' for backwards
   * compatibility.
   */
  coverage?: 'ok' | 'tool_returned_zero' | 'tool_not_applicable';
}

export function isAgenticSkillEnvelope(value: unknown): value is AgenticSkillEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.skill === 'string' &&
    v.status === 'awaiting_approval' &&
    Array.isArray(v.drafts) &&
    typeof v.summary === 'string'
  );
}
