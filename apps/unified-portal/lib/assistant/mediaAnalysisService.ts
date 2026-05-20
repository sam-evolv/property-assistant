/**
 * mediaAnalysisService. Sprint 1 placeholder.
 *
 * Real multimodal analysis lands in Sprint 1b. Only the body of `analyse`
 * changes then. The exported interface (MediaAnalysisInput, StructuredAnalysis,
 * MediaAnalysisResult) and the persistence shape stay stable so the routes,
 * UI, and downstream consumers do not need to move when the real model is
 * wired in.
 *
 * For now the service returns a safe stub:
 *   - residentMessage is the canonical placeholder copy from the spec
 *   - structured fields are all neutral defaults
 *   - action is always 'answer_only' (no issue creation, no escalation)
 *   - a row is persisted to assistant_media_analysis with
 *     model_provider = 'placeholder' so the UI and dashboards can be wired
 *     end to end against real database state.
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';

export type AssistantAction =
  | 'answer_only'
  | 'ask_for_more_info'
  | 'log_issue_memory'
  | 'create_issue_report'
  | 'escalate_issue'
  | 'flag_for_human_review';

export type SeverityLabel = 'low' | 'medium' | 'high' | 'urgent';
export type EscalationLevel = 'none' | 'developer_notify' | 'urgent';

export interface MediaAnalysisInput {
  tenantId: string;
  developmentId: string;
  unitId: string | null;
  conversationId: string;
  messageId: string;
  userId: string | null;
  userMessage: string;
  mediaIds: string[];
}

export interface StructuredAnalysis {
  issue_type: string | null;
  issue_category: string | null;
  room: string | null;
  visible_features: string[];
  severity_score: number | null;
  severity_label: SeverityLabel | null;
  confidence_score: number | null;
  safety_risk: boolean;
  safety_risk_type: string | null;
  likely_trade: string | null;
  likely_system: string | null;
  potential_causes: string[];
  recommended_action: string | null;
  resident_guidance: string | null;
  needs_more_info: boolean;
  more_info_requested: string[];
  should_create_issue: boolean;
  should_escalate: boolean;
  escalation_level: EscalationLevel | null;
  requires_human_review: boolean;
  warranty_relevant: boolean;
  similar_issue_check_required: boolean;
  developer_summary: string;
}

export interface MediaAnalysisResult {
  analysisId: string;
  residentMessage: string;
  developerSummary: string;
  structured: StructuredAnalysis;
  action: AssistantAction;
}

/**
 * Resident-facing placeholder copy. Kept in one place so when Sprint 1b
 * lands the real model the copy can be removed in a single edit rather
 * than hunted across the codebase.
 *
 * No em dashes. No emoji. Calm, peer-to-peer tone.
 */
const PLACEHOLDER_RESIDENT_MESSAGE =
  "Thanks for the photo. I've saved it against your home. Full analysis isn't enabled yet, but a member of the team can review it if needed.";

const PLACEHOLDER_DEVELOPER_SUMMARY =
  'Placeholder analysis. Real model wiring pending Sprint 1b.';

function neutralStructured(): StructuredAnalysis {
  return {
    issue_type: null,
    issue_category: null,
    room: null,
    visible_features: [],
    severity_score: null,
    severity_label: null,
    confidence_score: null,
    safety_risk: false,
    safety_risk_type: null,
    likely_trade: null,
    likely_system: null,
    potential_causes: [],
    recommended_action: 'placeholder',
    resident_guidance: null,
    needs_more_info: false,
    more_info_requested: [],
    should_create_issue: false,
    should_escalate: false,
    escalation_level: 'none',
    requires_human_review: false,
    warranty_relevant: false,
    similar_issue_check_required: false,
    developer_summary: PLACEHOLDER_DEVELOPER_SUMMARY,
  };
}

interface InsertAnalysisRow extends StructuredAnalysis {
  tenant_id: string;
  development_id: string;
  unit_id: string | null;
  user_id: string | null;
  conversation_id: string;
  message_id: string;
  input_media_ids: string[];
  raw_model_output: Record<string, unknown>;
  model_provider: string;
  model_name: string;
  model_version: string | null;
  prompt_version: string | null;
  processing_time_ms: number | null;
}

async function insertAnalysis(row: InsertAnalysisRow): Promise<{ id: string }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('assistant_media_analysis')
    .insert({
      tenant_id: row.tenant_id,
      development_id: row.development_id,
      unit_id: row.unit_id,
      user_id: row.user_id,
      conversation_id: row.conversation_id,
      message_id: row.message_id,
      analysis_scope: 'single_message',
      input_media_ids: row.input_media_ids,
      issue_type: row.issue_type,
      issue_category: row.issue_category,
      room: row.room,
      visible_features: row.visible_features,
      severity_score: row.severity_score,
      severity_label: row.severity_label,
      confidence_score: row.confidence_score,
      safety_risk: row.safety_risk,
      safety_risk_type: row.safety_risk_type,
      likely_trade: row.likely_trade,
      likely_system: row.likely_system,
      potential_causes: row.potential_causes,
      recommended_action: row.recommended_action,
      resident_guidance: row.resident_guidance,
      needs_more_info: row.needs_more_info,
      more_info_requested: row.more_info_requested,
      should_create_issue: row.should_create_issue,
      should_escalate: row.should_escalate,
      escalation_level: row.escalation_level,
      requires_human_review: row.requires_human_review,
      warranty_relevant: row.warranty_relevant,
      similar_issue_check_required: row.similar_issue_check_required,
      developer_summary: row.developer_summary,
      raw_model_output: row.raw_model_output,
      model_provider: row.model_provider,
      model_name: row.model_name,
      model_version: row.model_version,
      prompt_version: row.prompt_version,
      processing_time_ms: row.processing_time_ms,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `[mediaAnalysisService] failed to persist analysis row: ${error?.message ?? 'no row returned'}`,
    );
  }

  return { id: data.id as string };
}

export async function analyse(input: MediaAnalysisInput): Promise<MediaAnalysisResult> {
  const startedAt = Date.now();
  const structured = neutralStructured();

  const analysisRow = await insertAnalysis({
    tenant_id: input.tenantId,
    development_id: input.developmentId,
    unit_id: input.unitId,
    user_id: input.userId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    input_media_ids: input.mediaIds,
    raw_model_output: { placeholder: true },
    model_provider: 'placeholder',
    model_name: 'placeholder-v1',
    model_version: null,
    prompt_version: 'placeholder-v1',
    processing_time_ms: Date.now() - startedAt,
    ...structured,
  });

  return {
    analysisId: analysisRow.id,
    residentMessage: PLACEHOLDER_RESIDENT_MESSAGE,
    developerSummary: structured.developer_summary,
    structured,
    action: 'answer_only',
  };
}
