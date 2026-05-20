/**
 * Proactive Clarifier — detect ambiguous queries before answering
 *
 * When a query is ambiguous, it's better to ask a clarifying question
 * than to guess and potentially give a wrong answer.
 */

export interface ClarificationResult {
  needsClarification: boolean;
  clarificationQuestion?: string;
  ambiguousTerms: string[];
}

interface AmbiguityPattern {
  pattern: RegExp;
  check: (query: string, history: string[]) => boolean;
  question: string;
}

const AMBIGUITY_PATTERNS: AmbiguityPattern[] = [
  {
    pattern: /\b(it|this|that|the)\b/i,
    check: (_query: string, history: string[]) => {
      if (history.length === 0) return true;
      const lastTurn = history[history.length - 1].toLowerCase();
      return !/\b(room|unit|floor|kitchen|bedroom|bathroom|development|scheme|apartment)\b/.test(lastTurn);
    },
    question: 'Could you be more specific about what you\'re referring to?',
  },
  {
    pattern: /\b(the room|a room|which room)\b/i,
    check: () => true,
    question: 'Which room are you asking about? For example: kitchen, living room, or master bedroom?',
  },
  {
    pattern: /\b(size|dimension|big|small|area)\b/i,
    check: (query: string) => !/\b(square|sqm|sq ft|meter|metre|feet|foot)\b/i.test(query),
    question: 'Are you asking about the size of a specific room or the overall unit?',
  },
  {
    pattern: /\b(cost|price|fee|charge)\b/i,
    check: (query: string) => !/\b(service charge|management fee|ground rent|stamp duty|legal fee)\b/i.test(query),
    question: 'Which cost are you asking about? For example: service charge, management fees, or something else?',
  },
  {
    pattern: /\b(when|time|date|deadline)\b/i,
    check: (query: string) => !/\b(completion|handover|move|delivery|inspection|snagging)\b/i.test(query),
    question: 'Are you asking about a specific date? For example: completion date, handover date, or inspection schedule?',
  },
];

const SKIP_INTENTS = ['greeting', 'farewell', 'acknowledgment', 'humor', 'yes', 'no'];

export function checkNeedsClarification(
  query: string,
  conversationHistory: string[],
  intent: string
): ClarificationResult {
  const ambiguousTerms: string[] = [];
  let clarificationQuestion: string | undefined;

  // Skip clarification for certain intents
  if (SKIP_INTENTS.some(i => intent.toLowerCase().includes(i))) {
    return { needsClarification: false, ambiguousTerms: [] };
  }

  for (const { pattern, check, question } of AMBIGUITY_PATTERNS) {
    if (pattern.test(query) && check(query, conversationHistory)) {
      ambiguousTerms.push(pattern.source);
      clarificationQuestion = question;
    }
  }

  // Very short queries are often ambiguous
  const wordCount = query.split(/\s+/).length;
  if (wordCount < 4 && !/\?/.test(query) && ambiguousTerms.length === 0) {
    ambiguousTerms.push('very_short_query');
    clarificationQuestion = 'Could you provide more details about what you\'re looking for?';
  }

  return {
    needsClarification: ambiguousTerms.length > 0,
    clarificationQuestion,
    ambiguousTerms,
  };
}
