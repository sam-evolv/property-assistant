/**
 * Guardrail Logger — writes every guardrail evaluation to Supabase
 * so results are queryable without needing Vercel log drains.
 *
 * Usage: call logGuardrailEvaluation() after runGuardrails().
 * Best-effort: failures are caught and logged to console only.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key);
  return cachedClient;
}

export interface GuardrailLogPayload {
  requestId?: string;
  query: string;
  intent: string;
  confidenceOverall: number;
  confidenceDimensions: {
    grounding: number;
    specificity: number;
    consistency: number;
    completeness: number;
    safety: number;
  };
  riskFactors: string[];
  guardrailLog: Array<{
    guardrail: string;
    action: string;
    reason: string;
    timestamp: number;
  }>;
  wasModified: boolean;
  wasBlocked: boolean;
  shadowMode: boolean;
  turnCount: number;
  escalationLevel: number;
  clarificationTriggered: boolean;
  ambiguousTerms: string[];
  responseLength: number;
  isCorrectRefusal?: boolean;
  isFaithfulRepetition?: boolean;
  hasFalsePremise?: boolean;
  falsePremiseDetails?: string;
  isOffTopic?: boolean;
  portalFeatureAvailable?: boolean;
  portalFeatureMentioned?: boolean;
  unattestedNumericClaims?: string[];
  piiDetected?: boolean;
  intentMisreadDetected?: boolean;
}

// Simple hash for dedup / grouping
function hashQuery(q: string): string {
  let hash = 0;
  const s = q.toLowerCase().trim().slice(0, 200);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function logGuardrailEvaluation(
  payload: GuardrailLogPayload
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[GuardrailLogger] No Supabase client — skipping DB log');
    return;
  }

  try {
    await supabase.from('guardrail_evaluations').insert({
      request_id: payload.requestId || null,
      query_hash: hashQuery(payload.query),
      query_preview: payload.query.slice(0, 200),
      intent: payload.intent,
      confidence_overall: payload.confidenceOverall,
      confidence_grounding: payload.confidenceDimensions.grounding,
      confidence_specificity: payload.confidenceDimensions.specificity,
      confidence_consistency: payload.confidenceDimensions.consistency,
      confidence_completeness: payload.confidenceDimensions.completeness,
      confidence_safety: payload.confidenceDimensions.safety,
      risk_factors: payload.riskFactors,
      guardrail_log: payload.guardrailLog,
      was_modified: payload.wasModified,
      was_blocked: payload.wasBlocked,
      shadow_mode: payload.shadowMode,
      turn_count: payload.turnCount,
      escalation_level: payload.escalationLevel,
      clarification_triggered: payload.clarificationTriggered,
      ambiguous_terms: payload.ambiguousTerms,
      response_length: payload.responseLength,
      is_correct_refusal: payload.isCorrectRefusal ?? false,
      is_faithful_repetition: payload.isFaithfulRepetition ?? false,
      has_false_premise: payload.hasFalsePremise ?? false,
      false_premise_details: payload.falsePremiseDetails ?? '',
      is_off_topic: payload.isOffTopic ?? false,
      portal_feature_available: payload.portalFeatureAvailable ?? false,
      portal_feature_mentioned: payload.portalFeatureMentioned ?? false,
      unattested_numeric_claims: payload.unattestedNumericClaims ?? [],
      pii_detected: payload.piiDetected ?? false,
      intent_misread_detected: payload.intentMisreadDetected ?? false,
    });
  } catch (err: any) {
    // Best-effort: never break the chat flow
    console.error('[GuardrailLogger] Failed to write to Supabase:', err?.message || err);
  }
}
