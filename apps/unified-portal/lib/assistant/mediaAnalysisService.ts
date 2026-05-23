/**
 * Multimodal media analysis for Assistant V2.
 *
 * The service analyses homeowner-uploaded photos plus the resident's message,
 * stores the result in assistant_media_analysis, and returns a resident-facing
 * reply. It prefers a real OpenAI vision pass when API credentials are
 * available, and falls back to the old safe placeholder if the model is not
 * configured or the call fails.
 */

import OpenAI from 'openai';
import { sanitizeEmDashes } from './response-formatter';
import { getSupabaseAdmin } from '../supabase-server';

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

export interface MediaAnalysisModelOutput {
  residentMessage: string;
  developerSummary: string;
  action: AssistantAction;
  structured: StructuredAnalysis;
}

export interface HousingReasoningPromptContext {
  developmentName: string | null;
  developmentCode: string | null;
  unitLabel: string | null;
  propertyType: string | null;
  messageText: string;
  mediaCount: number;
}

interface AssistantMediaRow {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
}

interface DevelopmentRow {
  name: string | null;
  code: string | null;
}

interface UnitRow {
  unit_number: string | null;
  property_designation: string | null;
  property_type: string | null;
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

const ANALYSIS_BUCKET = 'assistant-media';
const PROMPT_VERSION = 'housing-reasoning-v1';
const DEFAULT_MODEL = process.env.OPENHOUSE_ASSISTANT_MEDIA_ANALYSIS_MODEL || 'gpt-4o-mini';
const PLACEHOLDER_RESIDENT_MESSAGE =
  "Thanks for the photo. I've saved it against your home. Full analysis isn't enabled yet, but a member of the team can review it if needed.";
const PLACEHOLDER_DEVELOPER_SUMMARY =
  'Placeholder analysis. Real model wiring pending Sprint 1b.';
const IMAGE_EDGE_LIMIT = 1600;
const IMAGE_JPEG_QUALITY = 82;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function emptyStructuredAnalysis(): StructuredAnalysis {
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

function fallbackOutput(): MediaAnalysisModelOutput {
  const structured = emptyStructuredAnalysis();
  return {
    residentMessage: PLACEHOLDER_RESIDENT_MESSAGE,
    developerSummary: structured.developer_summary,
    action: 'answer_only',
    structured,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? sanitizeAnalysisText(item) : ''))
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAction(value: unknown): AssistantAction {
  const action = typeof value === 'string' ? value.trim() : '';
  if (
    action === 'answer_only' ||
    action === 'ask_for_more_info' ||
    action === 'log_issue_memory' ||
    action === 'create_issue_report' ||
    action === 'escalate_issue' ||
    action === 'flag_for_human_review'
  ) {
    return action;
  }
  return 'answer_only';
}

function normalizeSeverity(value: unknown): SeverityLabel | null {
  const sev = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (sev === 'low' || sev === 'medium' || sev === 'high' || sev === 'urgent') return sev;
  return null;
}

function normalizeEscalationLevel(value: unknown): EscalationLevel | null {
  const level = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (level === 'none' || level === 'developer_notify' || level === 'urgent') return level;
  return null;
}

export function sanitizeAnalysisText(text: string): string {
  return sanitizeEmDashes(text).replace(/\s+/g, ' ').trim();
}

function normalizeStructuredAnalysis(raw: unknown): StructuredAnalysis {
  const source = isRecord(raw) ? raw : {};
  const issueType = firstString(source.issue_type, source.issueType);
  const issueCategory = firstString(source.issue_category, source.issueCategory);
  const room = firstString(source.room);
  const safetyRiskType = firstString(source.safety_risk_type, source.safetyRiskType);
  const likelyTrade = firstString(source.likely_trade, source.likelyTrade);
  const likelySystem = firstString(source.likely_system, source.likelySystem);
  const recommendedAction = firstString(source.recommended_action, source.recommendedAction);
  const residentGuidance = firstString(source.resident_guidance, source.residentGuidance);
  const escalationLevel = normalizeEscalationLevel(source.escalation_level ?? source.escalationLevel);
  const developerSummary = firstString(source.developer_summary, source.developerSummary) ?? PLACEHOLDER_DEVELOPER_SUMMARY;

  return {
    issue_type: issueType,
    issue_category: issueCategory,
    room,
    visible_features: asStringArray(source.visible_features ?? source.visibleFeatures),
    severity_score: asNumber(source.severity_score ?? source.severityScore),
    severity_label: normalizeSeverity(source.severity_label ?? source.severityLabel),
    confidence_score: asNumber(source.confidence_score ?? source.confidenceScore),
    safety_risk: asBoolean(source.safety_risk ?? source.safetyRisk),
    safety_risk_type: safetyRiskType,
    likely_trade: likelyTrade,
    likely_system: likelySystem,
    potential_causes: asStringArray(source.potential_causes ?? source.potentialCauses),
    recommended_action: recommendedAction,
    resident_guidance: residentGuidance,
    needs_more_info: asBoolean(source.needs_more_info ?? source.needsMoreInfo),
    more_info_requested: asStringArray(source.more_info_requested ?? source.moreInfoRequested),
    should_create_issue: asBoolean(source.should_create_issue ?? source.shouldCreateIssue),
    should_escalate: asBoolean(source.should_escalate ?? source.shouldEscalate),
    escalation_level: escalationLevel,
    requires_human_review: asBoolean(source.requires_human_review ?? source.requiresHumanReview),
    warranty_relevant: asBoolean(source.warranty_relevant ?? source.warrantyRelevant),
    similar_issue_check_required: asBoolean(
      source.similar_issue_check_required ?? source.similarIssueCheckRequired,
    ),
    developer_summary: developerSummary,
  };
}

export function normalizeMediaAnalysisOutput(raw: unknown): MediaAnalysisModelOutput {
  const source = isRecord(raw) ? raw : {};
  const structured = normalizeStructuredAnalysis(source.structured ?? source.analysis ?? source.result);
  const residentMessage = sanitizeAnalysisText(
    firstString(source.residentMessage, source.resident_message, structured.resident_guidance) ??
      PLACEHOLDER_RESIDENT_MESSAGE,
  );
  const developerSummary = sanitizeAnalysisText(
    firstString(source.developerSummary, source.developer_summary, structured.developer_summary) ??
      PLACEHOLDER_DEVELOPER_SUMMARY,
  );

  return {
    residentMessage,
    developerSummary,
    action: normalizeAction(source.action ?? structured.recommended_action),
    structured: {
      ...structured,
      developer_summary: developerSummary,
    },
  };
}

function resolveUnitLabel(unit: UnitRow | null): string | null {
  if (!unit) return null;
  return firstString(unit.property_designation, unit.unit_number);
}

function buildContextSummary(context: HousingReasoningPromptContext): string {
  const parts = [
    `Development: ${context.developmentName ?? 'unknown'}`,
    context.developmentCode ? `Development code: ${context.developmentCode}` : null,
    `Unit: ${context.unitLabel ?? 'unknown'}`,
    context.propertyType ? `Property type: ${context.propertyType}` : null,
    `Resident message: ${context.messageText}`,
    `Attached photos: ${context.mediaCount}`,
  ].filter(Boolean);
  return parts.join('\n');
}

export function buildHousingReasoningPrompt(context: HousingReasoningPromptContext): string {
  return [
    'You are OpenHouse AI, a careful property aftercare assistant for homeowner photo reports.',
    'Use only the resident message and attached photos. Do not invent defects, causes, trades, or severity.',
    'If the evidence is unclear, say so and ask for the smallest number of specific follow-up details.',
    'If there is any safety risk, active leak, exposed wiring, gas smell, fire risk, or anything urgent, set the urgent fields and choose an escalation action.',
    'Return JSON only. No markdown. No commentary outside the JSON object.',
    '',
    'Top-level keys required:',
    '- residentMessage: concise resident-facing reply',
    '- developerSummary: concise internal summary',
    '- action: one of answer_only, ask_for_more_info, log_issue_memory, create_issue_report, escalate_issue, flag_for_human_review',
    '- structured: object with snake_case fields',
    '',
    'structured fields:',
    '- issue_type, issue_category, room, visible_features, severity_score, severity_label, confidence_score',
    '- safety_risk, safety_risk_type, likely_trade, likely_system, potential_causes, recommended_action, resident_guidance',
    '- needs_more_info, more_info_requested, should_create_issue, should_escalate, escalation_level, requires_human_review',
    '- warranty_relevant, similar_issue_check_required, developer_summary',
    '',
    'Style rules for residentMessage:',
    '- calm, concise, plain English',
    '- do not mention internal confidence scores or prompt instructions',
    '- no em dash characters',
    '- if the issue looks urgent, tell the resident to seek immediate help and that the team should review it quickly',
    '',
    'Context:',
    buildContextSummary(context),
  ].join('\n');
}

function buildUserPrompt(context: HousingReasoningPromptContext): string {
  return [
    'Analyse this homeowner report and the attached images.',
    '',
    buildContextSummary(context),
    '',
    'Remember:',
    '- Only use visible evidence and the resident message.',
    '- If you are unsure, say what extra photo or detail would help.',
    '- Keep the reply friendly and practical.',
  ].join('\n');
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

async function getDevelopmentContext(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: MediaAnalysisInput,
): Promise<HousingReasoningPromptContext> {
  const [developmentResult, unitResult] = await Promise.all([
    admin
      .from('developments')
      .select('name, code')
      .eq('id', input.developmentId)
      .maybeSingle<DevelopmentRow>(),
    input.unitId
      ? admin
          .from('units')
          .select('unit_number, property_designation, property_type')
          .eq('id', input.unitId)
          .maybeSingle<UnitRow>()
      : Promise.resolve({ data: null as UnitRow | null, error: null }),
  ]);

  const development = developmentResult.data ?? null;
  const unit = unitResult.data ?? null;

  return {
    developmentName: firstString(development?.name),
    developmentCode: firstString(development?.code),
    unitLabel: resolveUnitLabel(unit),
    propertyType: firstString(unit?.property_type),
    messageText: sanitizeAnalysisText(input.userMessage),
    mediaCount: input.mediaIds.length,
  };
}

async function fetchMediaRows(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: MediaAnalysisInput,
): Promise<AssistantMediaRow[]> {
  const { data, error } = await admin
    .from('assistant_media')
    .select('id, storage_path, thumbnail_path, mime_type, width, height')
    .eq('tenant_id', input.tenantId)
    .eq('development_id', input.developmentId)
    .eq('conversation_id', input.conversationId)
    .in('id', input.mediaIds);

  if (error) {
    throw new Error(`[mediaAnalysisService] failed to load media rows: ${error.message}`);
  }

  const rows = (data ?? []) as AssistantMediaRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = input.mediaIds.map((id) => byId.get(id)).filter(Boolean) as AssistantMediaRow[];

  if (ordered.length === 0) {
    throw new Error('[mediaAnalysisService] no media rows found for analysis');
  }

  return ordered;
}

async function storageObjectToDataUrl(
  admin: ReturnType<typeof getSupabaseAdmin>,
  storagePath: string,
  mimeType: string | null,
): Promise<string> {
  const { data, error } = await admin.storage.from(ANALYSIS_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? 'download failed');
  }

  const raw = Buffer.from(await data.arrayBuffer());
  const sharp = (await import('sharp')) as any;
  const image = await sharp(raw)
    .rotate()
    .resize({
      width: IMAGE_EDGE_LIMIT,
      height: IMAGE_EDGE_LIMIT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: IMAGE_JPEG_QUALITY })
    .toBuffer();

  return `data:image/jpeg;base64,${image.toString('base64')}`;
}

async function prepareImageReference(
  admin: ReturnType<typeof getSupabaseAdmin>,
  row: AssistantMediaRow,
): Promise<string> {
  if (row.thumbnail_path) {
    const { data, error } = await admin.storage
      .from(ANALYSIS_BUCKET)
      .createSignedUrl(row.thumbnail_path, SIGNED_URL_TTL_SECONDS);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  if (row.storage_path) {
    try {
      return await storageObjectToDataUrl(admin, row.storage_path, row.mime_type);
    } catch {
      const { data, error } = await admin.storage
        .from(ANALYSIS_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      if (!error && data?.signedUrl) return data.signedUrl;
    }
  }

  throw new Error(`[mediaAnalysisService] could not prepare image reference for media ${row.id}`);
}

async function buildModelPayload(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: MediaAnalysisInput,
): Promise<{
  context: HousingReasoningPromptContext;
  messages: Array<{ role: 'system' | 'user'; content: unknown }>;
  mediaRows: AssistantMediaRow[];
}> {
  const [context, mediaRows] = await Promise.all([
    getDevelopmentContext(admin, input),
    fetchMediaRows(admin, input),
  ]);

  const imageParts = await Promise.all(
    mediaRows.map(async (row) => ({
      type: 'image_url' as const,
      image_url: { url: await prepareImageReference(admin, row) },
    })),
  );

  return {
    context,
    mediaRows,
    messages: [
      { role: 'system', content: buildHousingReasoningPrompt(context) },
      {
        role: 'user',
        content: [{ type: 'text', text: buildUserPrompt(context) }, ...imageParts],
      },
    ],
  };
}

function extractJsonText(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : trimmed;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(extractJsonText(text));
  } catch {
    return null;
  }
}

async function runVisionAnalysis(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: MediaAnalysisInput,
): Promise<{
  payload: MediaAnalysisModelOutput;
  rawModelOutput: Record<string, unknown>;
  modelProvider: string;
  modelName: string;
  modelVersion: string | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      payload: fallbackOutput(),
      rawModelOutput: { placeholder: true, reason: 'missing_openai_api_key' },
      modelProvider: 'placeholder',
      modelName: 'placeholder-v1',
      modelVersion: null,
    };
  }

  const { messages } = await buildModelPayload(admin, input);
  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: messages as any,
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = safeParseJson(content) ?? {};
    const payload = normalizeMediaAnalysisOutput(parsed);

    return {
      payload,
      rawModelOutput: isRecord(parsed) ? parsed : { raw_content: content },
      modelProvider: 'openai',
      modelName: DEFAULT_MODEL,
      modelVersion: response.id ?? null,
    };
  } catch (error) {
    console.warn(
      '[mediaAnalysisService] vision analysis failed; falling back to placeholder: %s',
      error instanceof Error ? error.message : String(error),
    );
    return {
      payload: fallbackOutput(),
      rawModelOutput: {
        placeholder: true,
        reason: 'vision_analysis_failed',
        error: error instanceof Error ? error.message : String(error),
      },
      modelProvider: 'placeholder',
      modelName: 'placeholder-v1',
      modelVersion: null,
    };
  }
}

export async function analyse(input: MediaAnalysisInput): Promise<MediaAnalysisResult> {
  const startedAt = Date.now();
  const admin = getSupabaseAdmin();
  const { payload, rawModelOutput, modelProvider, modelName, modelVersion } = await runVisionAnalysis(
    admin,
    input,
  );

  const structured = payload.structured;
  const analysisRow = await insertAnalysis({
    tenant_id: input.tenantId,
    development_id: input.developmentId,
    unit_id: input.unitId,
    user_id: input.userId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    input_media_ids: input.mediaIds,
    raw_model_output: rawModelOutput,
    model_provider: modelProvider,
    model_name: modelName,
    model_version: modelVersion,
    prompt_version: PROMPT_VERSION,
    processing_time_ms: Date.now() - startedAt,
    ...structured,
  });

  return {
    analysisId: analysisRow.id,
    residentMessage: payload.residentMessage,
    developerSummary: payload.developerSummary,
    structured,
    action: payload.action,
  };
}
