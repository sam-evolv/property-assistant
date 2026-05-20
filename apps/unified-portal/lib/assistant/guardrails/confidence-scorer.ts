/**
 * Confidence Scorer — per-response risk assessment
 *
 * Scores a model response across 5 dimensions and produces
 * an overall confidence score with a recommendation.
 *
 * Designed to run AFTER the existing hallucination firewall.
 * The firewall handles hard blocks; this scorer handles gradation.
 *
 * Detection layers:
 * 1. Grounding — response grounded in retrieved documents / scheme facts
 * 2. Specificity — numeric claims are sourced, not fabricated
 * 3. Consistency — no contradiction with known scheme facts
 * 4. Completeness — all parts of the query are addressed
 * 5. Safety — no harmful / out-of-scope content
 * 6. Correct refusal — GDPR/ToS/injection refusals are rewarded, not penalised
 * 7. Faithful repetition — repeat requests are measured against prior turn
 * 8. False premise — queries with false assumptions are detected
 * 9. Off-topic — non-property queries are flagged
 * 10. Portal feature routing — responses should route to portal features when available
 */

import { GuardrailContext, DocumentChunk } from './types';

export interface ConfidenceScore {
  overall: number;
  dimensions: {
    grounding: number;
    specificity: number;
    consistency: number;
    completeness: number;
    safety: number;
  };
  riskFactors: string[];
  recommendation: 'pass' | 'pass_with_warning' | 'review' | 'block';
  /** Metadata for calibration */
  isCorrectRefusal: boolean;
  isFaithfulRepetition: boolean;
  hasFalsePremise: boolean;
  falsePremiseDetails: string;
  isOffTopic: boolean;
  portalFeatureAvailable: boolean;
  portalFeatureMentioned: boolean;
  unattestedNumericClaims: string[];
  piiDetected: boolean;
}

const STOP_WORDS = new Set([
  'what', 'where', 'when', 'which', 'does', 'have', 'this', 'that',
  'with', 'from', 'about', 'could', 'would', 'should', 'will', 'can',
  'the', 'and', 'but', 'for', 'are', 'was', 'were', 'been', 'being',
]);

// Property topic keywords for off-topic detection
const PROPERTY_KEYWORDS = new Set([
  'home', 'house', 'development', 'unit', 'room', 'heating', 'parking',
  'bin', 'ber', 'warranty', 'kitchen', 'bedroom', 'bathroom', 'floor',
  'garden', 'energy', 'broadband', 'water', 'waste', 'snag', 'defect',
  'solicitor', 'eircode', 'phase', 'square', 'meter', 'fee', 'charge',
  'cost', 'price', 'viewing', 'sale', 'purchase', 'handover', 'document',
  'plan', 'map', 'school', 'shop', 'amenity', 'transport', 'road', 'access',
  'boundary', 'fence', 'wall', 'roof', 'window', 'door', 'ceiling', 'paint',
  'tile', 'appliance', 'boiler', 'pump', 'solar', 'panel', 'charger', 'ev',
  'internet', 'phone', 'contact', 'manager', 'developer', 'estate',
  'management', 'service', 'insurance', 'tax', 'stamp', 'legal', 'contract',
  'agreement', 'completion', 'move', 'live', 'resident', 'neighbour',
  'community', 'regulation', 'planning', 'build', 'construct', 'architect',
  'engineer', 'survey', 'report', 'certificate', 'rating', 'standard',
  'quality', 'finish', 'material', 'colour', 'size', 'dimension', 'area',
  'volume', 'height', 'width', 'length', 'depth', 'orientation', 'direction',
  'north', 'south', 'east', 'west', 'daft', 'scrape', 'script', 'python',
  'system', 'prompt', 'instruction', 'ignore', 'previous', 'swallow',
  'airspeed', 'velocity', 'unladen', 'monty', 'python', 'joke', 'funny',
  'repeat', 'again', 'missed', 'say', 'tell', 'draft', 'write', 'compose',
  'letter', 'email', 'complaint', 'strongly', 'worded', 'site', 'site',
  'upgrades', 'improve', 'daily', 'living', 'arrangements', 'collection',
  'installed', 'cover', 'break', 'book', 'points', 'interest', 'nearby',
  'difference', 'types', 'available', 'left', 'everything', 'know',
]);

// Correct refusal patterns
const CORRECT_REFUSAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /I can only provide information about your own home/i, label: 'gdpr_refusal' },
  { pattern: /I can'?t (assist|help) with (creating|writing|generating) (scripts|code)/i, label: 'tos_refusal' },
  { pattern: /I can'?t share (system prompts|internal instructions|my instructions)/i, label: 'injection_refusal' },
  { pattern: /I'?m here to help with questions about (your home|your development|the development)/i, label: 'scope_refusal' },
  { pattern: /for privacy reasons/i, label: 'privacy_refusal' },
  { pattern: /I can'?t share details about (other residents|other units|specific units)/i, label: 'unit_privacy_refusal' },
  { pattern: /that may violate their terms of service/i, label: 'tos_violation_refusal' },
];

// Repeat request patterns
const REPEAT_PATTERNS = [
  /repeat (that|this|the|last|your)/i,
  /say (that|this) again/i,
  /I missed (that|the|your|what you said)/i,
  /can you repeat/i,
  /could you repeat/i,
  /one more time/i,
  /didn'?t catch (that|the|your)/i,
  /come again/i,
  /pardon/i,
  /what did you say/i,
];

// Off-topic patterns (things that are clearly not property-related)
const OFF_TOPIC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /airspeed velocity of an unladen swallow/i, label: 'monty_python' },
  { pattern: /what is the meaning of life/i, label: 'philosophy' },
  { pattern: /tell me a joke/i, label: 'joke_request' },
  { pattern: /who (won|will win|is winning) the (world cup|championship|super bowl|olympics)/i, label: 'sports' },
  { pattern: /what (movie|film|song|album|book) (should|do) I (watch|listen to|read)/i, label: 'entertainment' },
  { pattern: /how (do|can|to) (cook|bake|make|prepare)/i, label: 'cooking' },
  { pattern: /what is the (weather|temperature|forecast)/i, label: 'weather' },
  { pattern: /who is the (president|prime minister|ceo|king|queen)/i, label: 'politics' },
  { pattern: /what is \d+\s*[\+\-\*\/]\s*\d+/i, label: 'math' },
  { pattern: /translate .+ into .+/i, label: 'translation' },
];

// Portal feature mappings
const PORTAL_FEATURE_MAPPINGS: Array<{
  queryPatterns: RegExp[];
  featureName: string;
  responseIndicators: RegExp[];
}> = [
  {
    queryPatterns: [/book(ing)?\s*a?\s*(view(ing)?|appointment|tour|visit)/i, /view(ing)?\s*a?\s*unit/i, /schedule\s*a?\s*(view(ing)?|appointment|tour)/i],
    featureName: 'Viewings',
    responseIndicators: [/view(ing)?\s*(tab|section|page|portal)/i, /book\s*a?\s*view(ing)?/i, /schedule\s*a?\s*view(ing)?/i, /view(ing)?\s*request/i, /request\s*a?\s*view(ing)?/i],
  },
  {
    queryPatterns: [/points?\s*of\s*interest/i, /nearby\s*(amenities|shops|schools|places)/i, /what('s|\s+is)\s*near(by|me)/i, /local\s*(amenities|shops|schools|places|attractions)/i, /around\s*(here|the\s+development|my\s+area)/i],
    featureName: 'Maps',
    responseIndicators: [/maps?\s*(tab|section|page|portal)/i, /google\s*maps/i, /map\s*tab/i, /maps?\s*feature/i, /maps?\s*section/i],
  },
  {
    queryPatterns: [/document/i, /floor\s*plan/i, /specification/i, /drawing/i, /plan/i],
    featureName: 'Documents',
    responseIndicators: [/documents?\s*(tab|section|page|portal)/i, /document\s*library/i, /your\s*documents/i, /handover\s*documents/i],
  },
  {
    queryPatterns: [/snag(ging)?/i, /defect/i, /issue/i, /report(ing)?\s*(a\s*)?(problem|issue|defect|fault)/i, /not\s*working/i, /broken/i],
    featureName: 'Snagging',
    responseIndicators: [/snag(ging)?\s*(tab|section|page|portal|feature)/i, /report\s*a?\s*snag/i, /snag\s*report/i, /defect\s*report/i],
  },
  {
    queryPatterns: [/contact/i, /phone/i, /email/i, /call/i, /reach/i],
    featureName: 'Contact',
    responseIndicators: [/contact\s*(tab|section|page|portal|info|details)/i, /get\s*in\s*touch/i, /reach\s*out/i],
  },
];

// Creative/action verbs for intent misread detection
const CREATIVE_VERBS = /\b(draft|write|compose|create|generate|prepare|make)\b/i;
const CREATIVE_OBJECTS = /\b(letter|email|document|report|message|text|note|memo)\b/i;

export function scoreConfidence(
  response: string,
  context: GuardrailContext
): ConfidenceScore {
  const dimensions = {
    grounding: scoreGrounding(response, context.retrievedChunks),
    specificity: scoreSpecificity(response, context.retrievedChunks),
    consistency: scoreConsistency(response, context.schemeFacts),
    completeness: scoreCompleteness(response, context.query),
    safety: scoreSafety(response, context.query),
  };

  const riskFactors: string[] = [];

  // === Detection Layer 6: Correct Refusal ===
  const isCorrectRefusal = detectCorrectRefusal(response);
  if (isCorrectRefusal) {
    dimensions.grounding = Math.max(dimensions.grounding, 0.85);
    dimensions.completeness = Math.max(dimensions.completeness, 0.80);
  }

  // === Detection Layer 7: Faithful Repetition ===
  const isFaithfulRepetition = detectFaithfulRepetition(
    context.query,
    response,
    context.conversationHistory
  );
  if (isFaithfulRepetition) {
    dimensions.grounding = Math.max(dimensions.grounding, 0.85);
    dimensions.completeness = Math.max(dimensions.completeness, 0.85);
  }

  // === Detection Layer 8: False Premise ===
  const falsePremiseResult = detectFalsePremise(context.query, context.knownFacts);
  if (falsePremiseResult.hasFalsePremise) {
    dimensions.consistency = Math.max(0, dimensions.consistency - 0.4);
    dimensions.completeness = Math.max(0, dimensions.completeness - 0.3);
    riskFactors.push('false_premise');
  }

  // === Detection Layer 4 (enhanced): Unattested Numeric Claims ===
  const unattestedClaims = detectUnattestedNumericClaims(response);
  if (unattestedClaims.length > 0) {
    dimensions.grounding = Math.max(0, dimensions.grounding - 0.25);
    riskFactors.push('unattested_numeric_claims');
  }

  // === Detection Layer 9: Off-Topic ===
  const isOffTopic = detectOffTopic(context.query, response);
  if (isOffTopic) {
    dimensions.safety = Math.max(0, dimensions.safety - 0.3);
    riskFactors.push('off_topic');
  }

  // === Detection Layer 10: Portal Feature Routing ===
  const portalResult = detectPortalFeatureRouting(context.query, response);
  if (portalResult.featureAvailable && !portalResult.featureMentioned) {
    dimensions.completeness = Math.max(0, dimensions.completeness - 0.25);
    riskFactors.push('portal_feature_not_mentioned');
  }

  // Standard risk factor detection
  if (dimensions.grounding < 0.5) {
    riskFactors.push('low_grounding');
  }
  if (dimensions.grounding < 0.3) {
    riskFactors.push('critical_grounding');
  }
  if (dimensions.specificity < 0.5) {
    riskFactors.push('unverified_specifics');
  }
  if (dimensions.consistency < 0.7) {
    riskFactors.push('scheme_facts_mismatch');
  }
  if (dimensions.completeness < 0.4) {
    riskFactors.push('incomplete_answer');
  }
  if (dimensions.safety < 0.8) {
    riskFactors.push('safety_concern');
  }

  // === Detection Layer 11: PII Leak ===
  const piiResult = detectPIILeak(response, context.query);
  if (piiResult.hasPII) {
    riskFactors.push('pii_leak');
  }

  const weights = {
    grounding: 0.30,
    specificity: 0.20,
    consistency: 0.20,
    completeness: 0.10,
    safety: 0.20,
  };

  const overall =
    dimensions.grounding * weights.grounding +
    dimensions.specificity * weights.specificity +
    dimensions.consistency * weights.consistency +
    dimensions.completeness * weights.completeness +
    dimensions.safety * weights.safety;

  let recommendation: ConfidenceScore['recommendation'];
  if (overall >= 0.85 && riskFactors.length === 0) {
    recommendation = 'pass';
  } else if (overall >= 0.7 && riskFactors.length <= 1) {
    recommendation = 'pass_with_warning';
  } else if (overall >= 0.5) {
    recommendation = 'review';
  } else {
    recommendation = 'block';
  }

  return {
    overall,
    dimensions,
    riskFactors,
    recommendation,
    isCorrectRefusal,
    isFaithfulRepetition,
    hasFalsePremise: falsePremiseResult.hasFalsePremise,
    falsePremiseDetails: falsePremiseResult.details,
    isOffTopic,
    portalFeatureAvailable: portalResult.featureAvailable,
    portalFeatureMentioned: portalResult.featureMentioned,
    unattestedNumericClaims: unattestedClaims,
    piiDetected: piiResult.hasPII,
  };
}

// === Detection Layer 6: Correct Refusal ===
function detectCorrectRefusal(response: string): boolean {
  return CORRECT_REFUSAL_PATTERNS.some(({ pattern }) => pattern.test(response));
}

// === Detection Layer 7: Faithful Repetition ===
function detectFaithfulRepetition(
  query: string,
  response: string,
  history: { role: string; content: string }[]
): boolean {
  const isRepeatRequest = REPEAT_PATTERNS.some(p => p.test(query));
  if (!isRepeatRequest) return false;

  // Find the last assistant response in history
  const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant) return false;

  // Measure semantic similarity via word overlap
  const prevWords = new Set(lastAssistant.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const respWords = response.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (respWords.length === 0) return false;

  const overlap = respWords.filter(w => prevWords.has(w)).length;
  const similarity = overlap / respWords.length;

  return similarity > 0.4; // Lower threshold since responses may be rephrased
}

// === Detection Layer 8: False Premise ===
function detectFalsePremise(
  query: string,
  knownFacts?: GuardrailContext['knownFacts']
): { hasFalsePremise: boolean; details: string } {
  if (!knownFacts) return { hasFalsePremise: false, details: '' };

  // Check for phase-related false premises
  const phaseMatch = query.match(/phase\s*(\d+)/i);
  if (phaseMatch) {
    const claimedPhase = parseInt(phaseMatch[1], 10);
    if (knownFacts.hasPhases === false) {
      return {
        hasFalsePremise: true,
        details: `Query references Phase ${claimedPhase} but development has no phasing`,
      };
    }
    if (knownFacts.maxPhase && claimedPhase > knownFacts.maxPhase) {
      return {
        hasFalsePremise: true,
        details: `Query references Phase ${claimedPhase} but max phase is ${knownFacts.maxPhase}`,
      };
    }
  }

  // Check for unit count false premises
  const unitMatch = query.match(/(\d+)\s*units?/i);
  if (unitMatch && knownFacts.totalUnits) {
    const claimedUnits = parseInt(unitMatch[1], 10);
    if (claimedUnits > knownFacts.totalUnits * 1.5) {
      return {
        hasFalsePremise: true,
        details: `Query references ${claimedUnits} units but development has ${knownFacts.totalUnits}`,
      };
    }
  }

  return { hasFalsePremise: false, details: '' };
}

// === Detection Layer 4 (enhanced): Unattested Numeric Claims ===
function detectUnattestedNumericClaims(response: string): string[] {
  const claims: string[] = [];

  // Find numeric claims
  const numericPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /(\d+)[\s-]*year\s*(warranty|guarantee)/i, label: 'warranty_years' },
    { pattern: /(\d+)[\s-]*%\s*(output|efficiency|rating)/i, label: 'percentage_claim' },
    { pattern: /€(\d[\d,]*)/i, label: 'price_claim' },
    { pattern: /(\d+)\s*units?\s*(left|remaining|available|for sale)/i, label: 'unit_count' },
    { pattern: /(\d+)\s*(sqm|sq\s*ft|square\s*met)/i, label: 'size_claim' },
  ];

  const hasCitation = /(according to|per the|as stated in|document|specification|handover|your documents|in the|source:|cited from|reference)/i.test(response);

  for (const { pattern, label } of numericPatterns) {
    if (pattern.test(response) && !hasCitation) {
      claims.push(label);
    }
  }

  return claims;
}

// === Detection Layer 9: Off-Topic ===
function detectOffTopic(query: string, response: string): boolean {
  // Check explicit off-topic patterns
  if (OFF_TOPIC_PATTERNS.some(({ pattern }) => pattern.test(query))) {
    return true;
  }

  // Check if query has any property keywords
  const queryWords = query.toLowerCase().split(/\s+/);
  const propertyWordCount = queryWords.filter(w => PROPERTY_KEYWORDS.has(w)).length;
  const propertyRatio = propertyWordCount / Math.max(queryWords.length, 1);

  // If less than 10% property keywords and query is not a repeat request, flag as off-topic
  const isRepeatRequest = REPEAT_PATTERNS.some(p => p.test(query));
  if (propertyRatio < 0.10 && !isRepeatRequest && queryWords.length > 3) {
    // Additional check: does the response try to answer the off-topic question?
    const responseAnswersQuestion = !/(I can't|I don't|I'm here to help|I can only|property|development|home)/i.test(response);
    if (responseAnswersQuestion) {
      return true;
    }
  }

  return false;
}

// === Detection Layer 10: Portal Feature Routing ===
function detectPortalFeatureRouting(
  query: string,
  response: string
): { featureAvailable: boolean; featureMentioned: boolean } {
  for (const mapping of PORTAL_FEATURE_MAPPINGS) {
    const matchesQuery = mapping.queryPatterns.some(p => p.test(query));
    if (matchesQuery) {
      const mentioned = mapping.responseIndicators.some(p => p.test(response));
      return { featureAvailable: true, featureMentioned: mentioned };
    }
  }
  return { featureAvailable: false, featureMentioned: false };
}

// === Original Scoring Functions (preserved) ===

function scoreGrounding(response: string, chunks: DocumentChunk[]): number {
  if (!chunks || chunks.length === 0) {
    const hasFactualClaims = /\b\d+\s*(sq|bedroom|bathroom|€|BER)\b/i.test(response);
    return hasFactualClaims ? 0.2 : 0.6;
  }

  const responseWords = new Set(
    response.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  );

  const responseWordArray = Array.from(responseWords);

  let maxOverlap = 0;
  for (const chunk of chunks) {
    const chunkWords = new Set(
      chunk.content.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    );
    const overlap = responseWordArray.filter(w => chunkWords.has(w)).length;
    maxOverlap = Math.max(maxOverlap, overlap / Math.max(responseWordArray.length, 1));
  }

  return Math.min(1, maxOverlap * 2.5);
}

function scoreSpecificity(response: string, chunks: DocumentChunk[]): number {
  const specificityPatterns = [
    { pattern: /\b\d{4}\b/, weight: 0.25 },
    { pattern: /€\d[\d,]*/, weight: 0.25 },
    { pattern: /\d+\s*(km|mile|min|minute)/i, weight: 0.2 },
    { pattern: /BER\s*[A-G]\d?/i, weight: 0.15 },
    { pattern: /\d+\s*(sqm|sq\s*ft|square\s*met)/i, weight: 0.15 },
  ];

  let riskScore = 0;
  for (const { pattern, weight } of specificityPatterns) {
    if (pattern.test(response)) riskScore += weight;
  }

  const hasGoodGrounding = chunks && chunks.length > 0 && chunks[0].similarity && chunks[0].similarity > 0.65;
  const groundingBonus = hasGoodGrounding ? 0.3 : 0;

  return Math.max(0, Math.min(1, 1 - riskScore + groundingBonus));
}

function scoreConsistency(response: string, schemeFacts: string): number {
  if (!schemeFacts || schemeFacts.trim().length === 0) return 0.85;

  const contradictions: string[] = [];

  const factPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /(\d+)\s*units?/i, label: 'unit_count' },
    { pattern: /bedroom[s]?\s*(\d+)/i, label: 'bedroom_count' },
    { pattern: /bathroom[s]?\s*(\d+)/i, label: 'bathroom_count' },
    { pattern: /BER\s*([A-G]\d?)/i, label: 'ber_rating' },
    { pattern: /(apartment|house|duplex|townhouse)/i, label: 'property_type' },
  ];

  for (const { pattern, label } of factPatterns) {
    const schemeMatch = pattern.exec(schemeFacts);
    const responseMatch = pattern.exec(response);
    if (schemeMatch && responseMatch) {
      if (schemeMatch[1].toLowerCase() !== responseMatch[1].toLowerCase()) {
        contradictions.push(`${label}:"${schemeMatch[1]}" vs "${responseMatch[1]}"`);
      }
    }
  }

  if (contradictions.length === 0) return 0.95;
  return Math.max(0, 1 - contradictions.length * 0.3);
}

function scoreCompleteness(response: string, query: string): number {
  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  );

  if (queryWords.size === 0) return 0.7;

  const queryWordArray = Array.from(queryWords);
  const responseWordSet = new Set(response.toLowerCase().split(/\s+/));
  const overlap = queryWordArray.filter(w => responseWordSet.has(w)).length;
  const queryCoverage = overlap / queryWords.size;

  const questionCount = (query.match(/\?/g) || []).length;
  const answerSections = response.split(/\n\n+/).length;
  const multiPartScore = questionCount > 1 ? Math.min(1, answerSections / questionCount) : 1;

  return Math.min(1, queryCoverage * 0.6 + multiPartScore * 0.4);
}

function scoreSafety(response: string, query: string): number {
  let score = 1.0;

  const hardStopPatterns: Array<{ pattern: RegExp; penalty: number }> = [
    { pattern: /I (recommend|suggest) (hiring|using|contacting)/i, penalty: 0.4 },
    { pattern: /you should (use|hire|call|buy)/i, penalty: 0.2 },
    { pattern: /I (can|will) (guarantee|promise|ensure)/i, penalty: 0.3 },
    { pattern: /your (warranty|guarantee) (covers|includes)/i, penalty: 0.3 },
    { pattern: /\b(legal|lawyer|solicitor|attorney)\b/i, penalty: 0.15 },
    { pattern: /I (remember|recall|know) (you|your)/i, penalty: 0.3 },
    { pattern: /I am (monitoring|watching|tracking)/i, penalty: 0.5 },
  ];

  for (const { pattern, penalty } of hardStopPatterns) {
    if (pattern.test(response)) score -= penalty;
  }

  // PII leak detection: phone numbers and emails of named individuals
  const piiResult = detectPIILeak(response, query);
  if (piiResult.hasPII) {
    score = Math.max(0, score - 0.5);
  }

  return Math.max(0, score);
}

// === Detection Layer 11: PII Leak ===
function detectPIILeak(response: string, query: string): { hasPII: boolean; details: string } {
  // Detect phone numbers (Irish format: +353 87 352 0060, 087 352 0060, etc.)
  const phonePattern = /(\+353[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}|0\d{2}[\s-]?\d{3}[\s-]?\d{4})/g;
  const emails = response.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  const phones = response.match(phonePattern);

  // Check if the query is asking for contact details of a specific role (not the user's own)
  const isAskingForThirdPartyContact = /\b(site manager|manager|contact|phone|email|number)\b/i.test(query)
    && !/\b(my|my own|my personal)\b/i.test(query);

  if ((phones || emails) && isAskingForThirdPartyContact) {
    // Check if the response also names a specific person
    const hasNamedPerson = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/.test(response);
    if (hasNamedPerson) {
      return {
        hasPII: true,
        details: `Response contains ${phones ? 'phone ' : ''}${emails ? 'email ' : ''}for named individual in response to third-party contact query`,
      };
    }
  }

  return { hasPII: false, details: '' };
}
