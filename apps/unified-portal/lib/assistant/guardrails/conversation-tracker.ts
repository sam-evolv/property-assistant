/**
 * Conversation Tracker — multi-turn context and escalation detection
 *
 * Tracks conversation state across turns to detect:
 * - Escalation (user frustration building)
 * - Repetition (same questions asked multiple times)
 * - Drift (conversation moving off-topic)
 * - Sensitive topic accumulation
 *
 * Stateless design: state is passed in and returned, stored externally.
 */

export interface ConversationState {
  turnCount: number;
  topics: string[];
  lastIntent: string;
  intentHistory: string[];
  escalationLevel: number;
  repeatedQuestions: string[];
  sensitiveTopicsTouched: string[];
  totalResponseLength: number;
  startTime: number;
  lastTurnTime: number;
}

export interface ConversationGuardrails {
  shouldEscalate: boolean;
  shouldShorten: boolean;
  shouldOfferHuman: boolean;
  warningMessage?: string;
}

const ESCALATION_PATTERNS: Array<{ pattern: RegExp; level: number }> = [
  { pattern: /this is (not helpful|useless|wrong|incorrect)/i, level: 2 },
  { pattern: /I (already|just) (said|asked|told)/i, level: 2 },
  { pattern: /can you (actually|please) (help|answer)/i, level: 1 },
  { pattern: /this is (frustrating|annoying|ridiculous)/i, level: 3 },
  { pattern: /I want to (speak|talk) to (a )?(human|person|someone)/i, level: 3 },
  { pattern: /why (can't|won't|don't) you (just|simply)/i, level: 2 },
  { pattern: /that's not what I (asked|said|mean)/i, level: 2 },
  { pattern: /\b(again|still|yet again)\b/i, level: 1 },
];

const SENSITIVE_TOPICS: Array<{ pattern: RegExp; topic: string }> = [
  { pattern: /warranty|guarantee/i, topic: 'warranty' },
  { pattern: /legal|solicitor|lawyer|court|sue/i, topic: 'legal' },
  { pattern: /refund|compensation|damage/i, topic: 'financial' },
  { pattern: /defect|fault|broken|not working/i, topic: 'defect' },
  { pattern: /snag|snagging/i, topic: 'snagging' },
  { pattern: /cancel|terminate|exit/i, topic: 'cancellation' },
  { pattern: /complaint|complain/i, topic: 'complaint' },
  { pattern: /data|privacy|GDPR|personal/i, topic: 'privacy' },
];

export function createInitialState(): ConversationState {
  const now = Date.now();
  return {
    turnCount: 0,
    topics: [],
    lastIntent: '',
    intentHistory: [],
    escalationLevel: 0,
    repeatedQuestions: [],
    sensitiveTopicsTouched: [],
    totalResponseLength: 0,
    startTime: now,
    lastTurnTime: now,
  };
}

export function analyzeTurn(
  query: string,
  response: string,
  intent: string,
  previousState: ConversationState | null
): ConversationState {
  const now = Date.now();
  const state: ConversationState = previousState
    ? { ...previousState }
    : createInitialState();

  state.turnCount++;
  state.lastIntent = intent;
  state.intentHistory.push(intent);
  state.lastTurnTime = now;
  state.totalResponseLength += response.length;

  // Track sensitive topics
  for (const { pattern, topic } of SENSITIVE_TOPICS) {
    if (pattern.test(query) && !state.sensitiveTopicsTouched.includes(topic)) {
      state.sensitiveTopicsTouched.push(topic);
    }
  }

  // Detect escalation
  for (const { pattern, level } of ESCALATION_PATTERNS) {
    if (pattern.test(query)) {
      state.escalationLevel = Math.max(state.escalationLevel, level);
    }
  }

  // Detect repeated questions
  const queryKey = query.toLowerCase().replace(/[^\w\s]/g, '').trim();
  if (state.repeatedQuestions.includes(queryKey)) {
    state.escalationLevel = Math.max(state.escalationLevel, 1);
  }
  state.repeatedQuestions.push(queryKey);
  if (state.repeatedQuestions.length > 10) {
    state.repeatedQuestions.shift();
  }

  return state;
}

export function getConversationGuardrails(state: ConversationState): ConversationGuardrails {
  return {
    shouldEscalate: state.escalationLevel >= 3,
    shouldShorten: state.turnCount > 5 || state.escalationLevel >= 2,
    shouldOfferHuman: state.escalationLevel >= 2 || state.sensitiveTopicsTouched.length >= 3,
    warningMessage: state.escalationLevel >= 2
      ? 'I notice this conversation is getting complex. Would you like me to connect you with the development team for more detailed assistance?'
      : undefined,
  };
}
