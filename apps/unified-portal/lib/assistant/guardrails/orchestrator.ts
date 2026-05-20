/**
 * Guardrail Orchestrator — ties all guardrail modules together
 *
 * Runs the full pipeline:
 * 1. Update conversation state
 * 2. Get adaptive config
 * 3. Check if clarification is needed
 * 4. Score confidence
 * 5. Apply adaptive thresholds
 * 6. Apply conversation-level guardrails
 * 7. Log all decisions
 *
 * Designed to run AFTER the existing hallucination firewall and tone guardrails.
 */

import { GuardrailContext } from './types';
import { scoreConfidence, ConfidenceScore } from './confidence-scorer';
import {
  analyzeTurn,
  getConversationGuardrails,
  ConversationState,
  createInitialState,
} from './conversation-tracker';
import { checkNeedsClarification, ClarificationResult } from './proactive-clarifier';
import { getAdaptiveConfig, AdaptiveConfig } from './adaptive-thresholds';
import { logGuardrailEvaluation } from './guardrail-logger';

export interface GuardrailLogEntry {
  guardrail: string;
  action: 'pass' | 'modify' | 'block' | 'warn' | 'clarify';
  reason: string;
  timestamp: number;
}

export interface OrchestratorResult {
  finalResponse: string;
  wasModified: boolean;
  wasBlocked: boolean;
  confidence: ConfidenceScore;
  conversationState: ConversationState;
  clarification: ClarificationResult;
  adaptiveConfig: AdaptiveConfig;
  guardrailLog: GuardrailLogEntry[];
}

export interface OrchestratorInput {
  response: string;
  query: string;
  intent: string;
  context: GuardrailContext;
  conversationState: ConversationState | null;
  /** If true, only log — don't modify responses (shadow mode) */
  shadowMode?: boolean;
  /** Whether the query requires a creative response (draft, write, compose) */
  requiresCreativeResponse?: boolean;
}

export function runGuardrails(input: OrchestratorInput): OrchestratorResult {
  const { response, query, intent, context, conversationState, shadowMode = true } = input;
  const guardrailLog: GuardrailLogEntry[] = [];
  let finalResponse = response;
  let wasModified = false;
  let wasBlocked = false;

  // Step 1: Update conversation state
  const updatedState = analyzeTurn(query, response, intent, conversationState);

  // Step 2: Get adaptive config
  const adaptiveConfig = getAdaptiveConfig(context, updatedState);

  // Step 3: Check if clarification is needed
  const clarification = checkNeedsClarification(
    query,
    context.conversationHistory.map(m => m.content),
    intent
  );

  if (clarification.needsClarification && adaptiveConfig.enableProactiveClarification) {
    guardrailLog.push({
      guardrail: 'proactiveClarifier',
      action: 'clarify',
      reason: `Ambiguous: ${clarification.ambiguousTerms.join(', ')}`,
      timestamp: Date.now(),
    });

    if (!shadowMode) {
      return {
        finalResponse: clarification.clarificationQuestion || 'Could you provide more details?',
        wasModified: true,
        wasBlocked: false,
        confidence: {
          overall: 1,
          dimensions: { grounding: 1, specificity: 1, consistency: 1, completeness: 0.3, safety: 1 },
          riskFactors: [],
          recommendation: 'pass',
          isCorrectRefusal: false,
          isFaithfulRepetition: false,
          hasFalsePremise: false,
          falsePremiseDetails: '',
          isOffTopic: false,
          portalFeatureAvailable: false,
          portalFeatureMentioned: false,
          unattestedNumericClaims: [],
          piiDetected: false,
          intentMisreadDetected: false,
        },
        conversationState: updatedState,
        clarification,
        adaptiveConfig,
        guardrailLog,
      };
    }
  }

  // Step 4: Score confidence
  const confidence = scoreConfidence(finalResponse, context, input.requiresCreativeResponse || false);

  guardrailLog.push({
    guardrail: 'confidenceScorer',
    action: confidence.recommendation === 'block' ? 'block'
      : confidence.recommendation === 'review' ? 'warn' : 'pass',
    reason: `Score: ${confidence.overall.toFixed(2)}, Risks: ${confidence.riskFactors.join(', ') || 'none'}`,
    timestamp: Date.now(),
  });

  // Step 5: Apply adaptive thresholds
  if (!shadowMode) {
    if (confidence.overall < adaptiveConfig.blockThreshold) {
      wasBlocked = true;
      wasModified = true;
      finalResponse = getFallbackResponse(context.language);

      guardrailLog.push({
        guardrail: 'adaptiveThreshold',
        action: 'block',
        reason: `Confidence ${confidence.overall.toFixed(2)} < threshold ${adaptiveConfig.blockThreshold}`,
        timestamp: Date.now(),
      });
    } else if (confidence.recommendation === 'review') {
      wasModified = true;
      finalResponse += '\n\n*Note: For specific details, I recommend contacting the development team directly.*';

      guardrailLog.push({
        guardrail: 'adaptiveThreshold',
        action: 'modify',
        reason: `Confidence ${confidence.overall.toFixed(2)} in review range`,
        timestamp: Date.now(),
      });
    }
  }

  // Step 6: Apply conversation-level guardrails
  const convGuardrails = getConversationGuardrails(updatedState);

  if (!shadowMode) {
    if (convGuardrails.shouldOfferHuman && !finalResponse.includes('development team')) {
      wasModified = true;
      finalResponse += '\n\nIf you\'d prefer to speak with someone directly, I can connect you with the development team.';

      guardrailLog.push({
        guardrail: 'conversationTracker',
        action: 'modify',
        reason: `Escalation level ${updatedState.escalationLevel}, offering human handoff`,
        timestamp: Date.now(),
      });
    }

    if (convGuardrails.shouldShorten && finalResponse.length > adaptiveConfig.responseLengthLimit) {
      wasModified = true;
      const truncated = finalResponse.slice(0, adaptiveConfig.responseLengthLimit);
      const lastSentence = truncated.lastIndexOf('.');
      finalResponse = lastSentence > 100
        ? truncated.slice(0, lastSentence + 1)
        : truncated;
      finalResponse += '\n\n[Ask follow-up questions for more details.]';

      guardrailLog.push({
        guardrail: 'conversationTracker',
        action: 'modify',
        reason: `Response truncated at ${adaptiveConfig.responseLengthLimit} chars (turn ${updatedState.turnCount})`,
        timestamp: Date.now(),
      });
    }
  }

  // Always log conversation-level insights even in shadow mode
  if (convGuardrails.shouldEscalate) {
    guardrailLog.push({
      guardrail: 'conversationTracker',
      action: 'warn',
      reason: `Escalation level ${updatedState.escalationLevel} — consider human handoff`,
      timestamp: Date.now(),
    });
  }

  // Log to Supabase for analysis (async, best-effort, never blocks response)
  const logPayload = {
    requestId: context.requestId,
    query: query,
    intent: intent,
    confidenceOverall: confidence.overall,
    confidenceDimensions: confidence.dimensions,
    riskFactors: confidence.riskFactors,
    guardrailLog: guardrailLog,
    wasModified: wasModified,
    wasBlocked: wasBlocked,
    shadowMode: shadowMode,
    turnCount: updatedState.turnCount,
    escalationLevel: updatedState.escalationLevel,
    clarificationTriggered: clarification.needsClarification,
    ambiguousTerms: clarification.ambiguousTerms,
    responseLength: finalResponse.length,
    isCorrectRefusal: confidence.isCorrectRefusal,
    isFaithfulRepetition: confidence.isFaithfulRepetition,
    hasFalsePremise: confidence.hasFalsePremise,
    falsePremiseDetails: confidence.falsePremiseDetails,
    isOffTopic: confidence.isOffTopic,
    portalFeatureAvailable: confidence.portalFeatureAvailable,
    portalFeatureMentioned: confidence.portalFeatureMentioned,
    unattestedNumericClaims: confidence.unattestedNumericClaims,
    piiDetected: confidence.piiDetected,
    intentMisreadDetected: confidence.intentMisreadDetected,
  };

  // Fire-and-forget: don't await, don't block the response
  console.log(`[Guardrail] Logging to Supabase: requestId=${context.requestId}, confidence=${confidence.overall.toFixed(2)}, shadow=${shadowMode}`);
  logGuardrailEvaluation(logPayload).catch((err: any) => {
    console.error('[Guardrail] Supabase log failed:', err?.message || err);
  });

  return {
    finalResponse,
    wasModified,
    wasBlocked,
    confidence,
    conversationState: updatedState,
    clarification,
    adaptiveConfig,
    guardrailLog,
  };
}

function getFallbackResponse(language: string): string {
  const fallbacks: Record<string, string> = {
    en: "I don't have verified information about that specific detail. Would you like me to help with something else, or connect you with the development team?",
    fr: "Je n'ai pas d'informations vérifiées sur ce détail. Puis-je vous aider avec autre chose?",
    de: "Ich habe keine verifizierten Informationen zu diesem Detail. Kann ich Ihnen mit etwas anderem helfen?",
    es: "No tengo información verificada sobre ese detalle. ¿Puedo ayudarle con algo más?",
    pl: "Nie mam zweryfikowanych informacji na ten temat. Czy mogę pomóc w czymś innym?",
    ro: "Nu am informații verificate despre acest detaliu. Pot să vă ajut cu altceva?",
    zh: "我没有关于该具体细节的验证信息。您还需要其他帮助吗？",
    ar: "ليس لدي معلومات مؤكدة حول هذا التفصيل. هل يمكنني مساعدتك بشيء آخر؟",
    ga: "Níl faisnéis fíoraithe agam faoin sonrach sin. An bhfuil mé in ann cabhrú leat le rud eile?",
  };
  return fallbacks[language] || fallbacks.en;
}
