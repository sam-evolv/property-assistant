/**
 * mediaAnalysisService — real multimodal analysis (Sprint 1b).
 *
 * gpt-4o reads the snag photos + description and produces the structured
 * assessment (room, trade, severity, safety) that powers prioritisation,
 * the Houses screen chips and the issues dashboard.
 *
 * The exported interface (MediaAnalysisInput, StructuredAnalysis,
 * MediaAnalysisResult) and the persistence shape are unchanged from the
 * Sprint 1 placeholder, and the service is strictly fail-soft: no API key,
 * a timeout, or a malformed model reply all fall back to the neutral
 * placeholder row exactly as before. Analysis must never block or break
 * the capture path.
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

const PLACEHOLDER_RESIDENT_MESSAGE =
  "Thanks for the photo. I've saved it against your home. Full analysis isn't enabled yet, but a member of the team can review it if needed.";

const PLACEHOLDER_DEVELOPER_SUMMARY =
  'Placeholder analysis. Real model wiring pending Sprint 1b.';

const DEFAULT_RESIDENT_MESSAGE =
  "Thanks for the photo. I've saved it against your home and noted the details for the team.";

const MODEL_TIMEOUT_MS = 20_000;
const SIGNED_URL_TTL_SECONDS = 600;
const MAX_IMAGES = 6;
const PROMPT_VERSION = 'snag-analysis-v1';

const SEVERITY_LABELS = new Set<SeverityLabel>(['low', 'medium', 'high', 'urgent']);
const TRADES = new Set([
  'plumbing', 'electrical', 'carpentry', 'painting', 'plastering', 'tiling',
  'roofing', 'windows_doors', 'kitchen', 'flooring', 'heating_ventilation',
  'landscaping', 'bricklaying', 'general',
]);

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

/** Signed URLs for the snag photos, tenant-checked. Failures just mean fewer images. */
async function signedImageUrls(tenantId: string, mediaIds: string[]): Promise<string[]> {
  if (mediaIds.length === 0) return [];
  try {
    const admin = getSupabaseAdmin();
    const { data: rows } = await admin
      .from('assistant_media')
      .select('id, tenant_id, storage_path, mime_type')
      .in('id', mediaIds.slice(0, MAX_IMAGES));
    const urls: string[] = [];
    for (const m of rows || []) {
      if (m.tenant_id !== tenantId) continue;
      if (m.mime_type && !String(m.mime_type).startsWith('image/')) continue;
      const { data: signed } = await admin.storage
        .from('assistant-media')
        .createSignedUrl(m.storage_path as string, SIGNED_URL_TTL_SECONDS);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }
    return urls;
  } catch {
    return [];
  }
}

function str(v: unknown, max = 300): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

function strArray(v: unknown, max = 8): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, max)
    : [];
}

function clamp01(v: unknown): number | null {
  const n = typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
}

/** Coerces whatever the model returned into a safe StructuredAnalysis. */
function coerceModelOutput(parsed: Record<string, unknown>): StructuredAnalysis {
  const severityLabelRaw = String(parsed.severity_label || '').toLowerCase();
  const severity_label = SEVERITY_LABELS.has(severityLabelRaw as SeverityLabel)
    ? (severityLabelRaw as SeverityLabel)
    : null;

  const tradeRaw = String(parsed.likely_trade || '').toLowerCase().replace(/[\s\-]+/g, '_');
  const likely_trade = TRADES.has(tradeRaw) ? tradeRaw : str(parsed.likely_trade, 50);

  const severityScoreRaw = typeof parsed.severity_score === 'number' ? parsed.severity_score : NaN;
  const severity_score = Number.isFinite(severityScoreRaw)
    ? Math.min(100, Math.max(0, Math.round(severityScoreRaw)))
    : severity_label === 'urgent' ? 90
    : severity_label === 'high' ? 75
    : severity_label === 'medium' ? 50
    : severity_label === 'low' ? 25
    : null;

  const confidence_score = clamp01(parsed.confidence_score);
  const safety_risk = parsed.safety_risk === true;

  return {
    issue_type: str(parsed.issue_type, 80),
    issue_category: str(parsed.issue_category, 80),
    room: str(parsed.room, 60),
    visible_features: strArray(parsed.visible_features),
    severity_score,
    severity_label,
    confidence_score,
    safety_risk,
    safety_risk_type: safety_risk ? str(parsed.safety_risk_type, 100) : null,
    likely_trade,
    likely_system: str(parsed.likely_system, 60),
    potential_causes: strArray(parsed.potential_causes),
    recommended_action: str(parsed.recommended_action, 400),
    resident_guidance: str(parsed.resident_guidance, 600),
    needs_more_info: parsed.needs_more_info === true,
    more_info_requested: strArray(parsed.more_info_requested, 4),
    should_create_issue: parsed.should_create_issue === true,
    should_escalate: safety_risk,
    escalation_level: safety_risk ? 'developer_notify' : 'none',
    requires_human_review: safety_risk || (confidence_score !== null && confidence_score < 0.4),
    warranty_relevant: parsed.warranty_relevant === true,
    similar_issue_check_required: parsed.similar_issue_check_required === true,
    developer_summary:
      str(parsed.developer_summary, 300) || 'Analysed snag — see structured fields.',
  };
}

async function callModel(
  userMessage: string,
  imageUrls: string[],
): Promise<{ structured: StructuredAnalysis; raw: Record<string, unknown>; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!userMessage.trim() && imageUrls.length === 0) return null;

  const model = process.env.SNAG_ANALYSIS_MODEL || 'gpt-4o';

  const systemPrompt = [
    'You assess snags (defects) in new-build Irish homes from site photos and short descriptions.',
    'Reply with ONE JSON object, no prose, with these keys:',
    'issue_type (short noun phrase), issue_category (finish|structural|mechanical|electrical|plumbing|external|other),',
    'room (the room/area if identifiable), visible_features (array of strings),',
    'severity_score (0-100), severity_label (low|medium|high|urgent), confidence_score (0-1),',
    'safety_risk (boolean), safety_risk_type (string or null),',
    `likely_trade (one of: ${Array.from(TRADES).join('|')}),`,
    'likely_system (e.g. heating, ventilation, windows, or null), potential_causes (array),',
    'recommended_action (one sentence for the site team),',
    'resident_guidance (one or two calm sentences for the homeowner, no promises about timing, no em dashes, no emoji),',
    'needs_more_info (boolean), more_info_requested (array), warranty_relevant (boolean),',
    'similar_issue_check_required (boolean), should_create_issue (boolean),',
    'developer_summary (ONE factual sentence: what and where).',
    'Judge severity like an experienced Irish site manager: cosmetic paint = low; functional defects = medium/high; anything involving gas, exposed wiring, water near electrics, structural movement or fall risks = urgent with safety_risk true.',
  ].join('\n');

  const content: Array<Record<string, unknown>> = [];
  if (userMessage.trim()) {
    content.push({ type: 'text', text: userMessage.trim().slice(0, 2000) });
  } else {
    content.push({ type: 'text', text: 'No description provided. Assess from the photos.' });
  }
  for (const url of imageUrls) {
    content.push({ type: 'image_url', image_url: { url, detail: 'auto' } });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') return null;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return { structured: coerceModelOutput(parsed), raw: parsed, model };
  } catch {
    return null;
  }
}

export async function analyse(input: MediaAnalysisInput): Promise<MediaAnalysisResult> {
  const startedAt = Date.now();

  const imageUrls = await signedImageUrls(input.tenantId, input.mediaIds);
  const modelResult = await callModel(input.userMessage || '', imageUrls);

  if (!modelResult) {
    // Fail-soft: identical behaviour to the Sprint 1 placeholder.
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

  const { structured, raw, model } = modelResult;
  const analysisRow = await insertAnalysis({
    tenant_id: input.tenantId,
    development_id: input.developmentId,
    unit_id: input.unitId,
    user_id: input.userId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    input_media_ids: input.mediaIds,
    raw_model_output: raw,
    model_provider: 'openai',
    model_name: model,
    model_version: null,
    prompt_version: PROMPT_VERSION,
    processing_time_ms: Date.now() - startedAt,
    ...structured,
  });

  return {
    analysisId: analysisRow.id,
    residentMessage: structured.resident_guidance || DEFAULT_RESIDENT_MESSAGE,
    developerSummary: structured.developer_summary,
    structured,
    // Conservative: enrichment informs, callers decide. Escalation intent
    // travels in structured.should_escalate / escalation_level.
    action: 'answer_only',
  };
}
