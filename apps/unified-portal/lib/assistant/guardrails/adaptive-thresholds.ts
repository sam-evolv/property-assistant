/**
 * Adaptive Thresholds — per-context guardrail configuration
 *
 * Adjusts guardrail strictness based on:
 * - User trust level (verified, history length)
 * - Query complexity (word count, question count)
 * - Conversation state (escalation, turn count, sensitive topics)
 * - Time of day (after hours = more conservative)
 */

export interface AdaptiveConfig {
  confidenceThreshold: number;
  blockThreshold: number;
  maxTurnsBeforeEscalation: number;
  enableProactiveClarification: boolean;
  responseLengthLimit: number;
}

import { ConversationState } from './conversation-tracker';
import { GuardrailContext } from './types';

const DEFAULT_CONFIG: AdaptiveConfig = {
  confidenceThreshold: 0.7,
  blockThreshold: 0.4,
  maxTurnsBeforeEscalation: 8,
  enableProactiveClarification: true,
  responseLengthLimit: 500,
};

export function getAdaptiveConfig(
  context: GuardrailContext,
  conversationState: ConversationState | null
): AdaptiveConfig {
  const config = { ...DEFAULT_CONFIG };

  // User trust level — verified units with purchaser info get more leeway
  if (context.unitInfo?.purchaser_name) {
    config.confidenceThreshold = 0.6;
    config.responseLengthLimit = 700;
  }

  // Query complexity
  const queryWordCount = context.query.split(/\s+/).length;
  const questionCount = (context.query.match(/\?/g) || []).length;

  if (queryWordCount > 30 || questionCount > 2) {
    config.confidenceThreshold = 0.65;
    config.responseLengthLimit = 800;
  }

  if (queryWordCount < 5) {
    config.enableProactiveClarification = true;
  }

  // Conversation state
  if (conversationState) {
    if (conversationState.escalationLevel >= 2) {
      config.confidenceThreshold = 0.8;
      config.maxTurnsBeforeEscalation = 5;
    }

    if (conversationState.turnCount > 10) {
      config.maxTurnsBeforeEscalation = 12;
    }

    if (conversationState.sensitiveTopicsTouched.length >= 3) {
      config.confidenceThreshold = 0.85;
      config.blockThreshold = 0.5;
    }
  }

  // Time of day (after hours = more conservative, no human backup)
  const hour = new Date().getHours();
  if (hour < 8 || hour > 21) {
    config.confidenceThreshold = Math.max(config.confidenceThreshold, 0.8);
    config.enableProactiveClarification = true;
  }

  return config;
}
