/**
 * Response Style Wrapper for Tone Guardrails
 * Ensures assistant always sounds like a calm, competent local guide
 * Three modes: normal, friendly_guidance, safety
 */

import {
  applyPhraseReplacements,
  removeEmDashes,
  mapIntentToFamily,
  getRandomIntro,
  getRandomLowConfidenceIntro,
  getRandomSafetyIntro,
  isNoFollowUpIntent,
  type IntentFamily,
} from './phrases';

export type ResponseMode = 'normal' | 'friendly_guidance' | 'safety';

export interface ResponseStyleInput {
  intentType: string;
  safetyIntercept: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  sourceType: 'docs' | 'places' | 'playbook' | 'general' | 'escalation';
  schemeName?: string;
  includeSourceHint?: boolean;
}

export interface ResponseStyleOutput {
  mode: ResponseMode;
  allowHumor: boolean;
  allowFollowUp: boolean;
  intro: string | null;
  sourceHint: string | null;
}

const TONE_GUARDRAILS_FLAG = 'ASSISTANT_TONE_GUARDRAILS';

export function isToneGuardrailsEnabled(): boolean {
  return process.env[TONE_GUARDRAILS_FLAG] === 'true';
}

const SAFETY_INTENTS = [
  'emergency',
  'gas_leak',
  'fire',
  'electrical',
  'flood',
  'structural',
  'medical',
  'safety',
];

const LEGAL_INTENTS = [
  'legal',
  'contract',
  'liability',
  'solicitor',
  'dispute',
];

const DEFECT_INTENTS = [
  'defect',
  'snag',
  'damage',
  'broken',
  'crack',
  'leak',
  'damp',
  'mould',
];

export function determineResponseMode(input: ResponseStyleInput): ResponseMode {
  const normalizedIntent = input.intentType.toLowerCase();
  
  if (input.safetyIntercept) {
    return 'safety';
  }
  
  if (SAFETY_INTENTS.some(s => normalizedIntent.includes(s))) {
    return 'safety';
  }
  
  if (LEGAL_INTENTS.some(l => normalizedIntent.includes(l))) {
    return 'safety';
  }
  
  if (DEFECT_INTENTS.some(d => normalizedIntent.includes(d))) {
    return 'friendly_guidance';
  }
  
  if (input.confidence === 'low' || input.confidence === 'none') {
    return 'friendly_guidance';
  }
  
  return 'normal';
}

export function getResponseStyle(input: ResponseStyleInput): ResponseStyleOutput {
  const mode = determineResponseMode(input);
  const intentFamily = mapIntentToFamily(input.intentType);
  
  const allowHumor = mode === 'normal';
  const allowFollowUp = mode !== 'safety' && !isNoFollowUpIntent(input.intentType);
  
  let intro: string | null = null;
  
  if (mode === 'safety') {
    intro = getRandomSafetyIntro();
  } else if (mode === 'friendly_guidance') {
    intro = getRandomLowConfidenceIntro();
  }
  
  let sourceHint: string | null = null;
  if (input.includeSourceHint && mode !== 'safety') {
    sourceHint = getSourceHint(input.sourceType, input.schemeName);
  }
  
  return {
    mode,
    allowHumor,
    allowFollowUp,
    intro,
    sourceHint,
  };
}

function getSourceHint(sourceType: string, schemeName?: string): string | null {
  const schemeRef = schemeName ? ` for ${schemeName}` : '';
  
  switch (sourceType) {
    case 'docs':
      return `Source: Your home documentation${schemeRef}`;
    case 'places':
      return `Source: Live location data`;
    case 'playbook':
      return `Source: General guidance`;
    case 'escalation':
      return null;
    default:
      return null;
  }
}

export function applyToneGuardrails(
  response: string,
  input: ResponseStyleInput
): string {
  if (!isToneGuardrailsEnabled()) {
    return response;
  }
  
  let result = response;
  
  result = applyPhraseReplacements(result);
  
  result = removeEmDashes(result);
  
  result = normalizeFormatting(result);
  
  const style = getResponseStyle(input);
  
  if (style.intro && !response.trim().startsWith(style.intro)) {
    const needsNewline = result.trim().length > 0;
    result = style.intro + (needsNewline ? '\n\n' : '') + result;
  }
  
  if (style.sourceHint && !result.includes('Source:')) {
    result = result.trimEnd() + '\n\n' + style.sourceHint;
  }
  
  return result;
}

function normalizeFormatting(text: string): string {
  let result = text;
  
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/\*([^*]+)\*/g, '$1');
  result = result.replace(/_([^_]+)_/g, '$1');
  
  result = result.replace(/^[-•]\s*/gm, '- ');
  result = result.replace(/^\*\s+/gm, '- ');
  result = result.replace(/^[0-9]+\.\s+/gm, '- ');
  
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result;
}

export function stripHumorFromResponse(response: string): string {
  const jokePatterns = [
    /Here'?s a (?:little )?(?:joke|bit of humou?r)[^.!?]*[.!?]/gi,
    /Speaking of which[^.!?]*joke[^.!?]*[.!?]/gi,
    /\*?(?:wink|grin|smile|laugh)\*?/gi,
    /(?:Ha!|Haha!?|LOL)/gi,
  ];
  
  let result = response;
  for (const pattern of jokePatterns) {
    result = result.replace(pattern, '');
  }
  
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export function stripFollowUpSuggestions(response: string): string {
  const followUpPatterns = [
    /(?:Feel free to|Don'?t hesitate to|If you'?d like|Just let me know if)[^.!?]*[.!?]/gi,
    /(?:I can also help|I'?m happy to help|Would you like me to)[^.!?]*[.!?]/gi,
    /(?:If you have any other questions|Anything else)[^.!?]*[.!?]/gi,
  ];
  
  let result = response;
  for (const pattern of followUpPatterns) {
    result = result.replace(pattern, '');
  }
  
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export function applySafetyMode(response: string): string {
  let result = response;
  
  result = stripHumorFromResponse(result);
  result = stripFollowUpSuggestions(result);
  result = applyPhraseReplacements(result);
  result = removeEmDashes(result);
  
  return result.trim();
}

export function wrapResponse(
  response: string,
  input: ResponseStyleInput
): string {
  if (!isToneGuardrailsEnabled()) {
    return response;
  }
  
  const style = getResponseStyle(input);
  
  let result = response;
  
  if (style.mode === 'safety') {
    result = applySafetyMode(result);
  } else {
    result = applyPhraseReplacements(result);
    result = removeEmDashes(result);
  }
  
  if (!style.allowHumor) {
    result = stripHumorFromResponse(result);
  }
  
  if (!style.allowFollowUp) {
    result = stripFollowUpSuggestions(result);
  }
  
  return result;
}

export function shouldBlockHumor(input: ResponseStyleInput): boolean {
  const style = getResponseStyle(input);
  return !style.allowHumor;
}

export function shouldBlockFollowUp(input: ResponseStyleInput): boolean {
  const style = getResponseStyle(input);
  return !style.allowFollowUp;
}
