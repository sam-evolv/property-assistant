/**
 * Hallucination Firewall - Response Validator
 * 
 * Prevents the assistant from making ungrounded factual claims.
 * Enforces grounding requirements and replaces unverified content with safe alternatives.
 */

import {
  GroundingContext,
  getGroundingPolicy,
  isSourceGrounded,
  detectUngroundedSpecificity,
  isHallucinationFirewallEnabled,
} from './grounding-policy';

export interface FirewallInput {
  answerText: string;
  intent: string;
  source: string;
  metadata?: {
    hasPlacesData?: boolean;
    hasArchiveMatch?: boolean;
    archiveConfidence?: number;
    hasApprovedFacts?: boolean;
    schemeId?: string;
    isPlaybook?: boolean;
    isSchemeProfile?: boolean;
  };
  citations?: string[];
}

export interface FirewallResult {
  safeAnswerText: string;
  modified: boolean;
  violationType?: string;
  violations?: string[];
  groundingContext?: GroundingContext;
}

export function enforceGrounding(input: FirewallInput): FirewallResult {
  if (!isHallucinationFirewallEnabled()) {
    return {
      safeAnswerText: input.answerText,
      modified: false,
    };
  }
  
  const { answerText, intent, source, metadata = {}, citations = [] } = input;
  
  const groundingContext: GroundingContext = {
    sourceType: mapSourceToGroundedType(source, metadata),
    hasPlacesData: metadata.hasPlacesData ?? false,
    hasArchiveMatch: metadata.hasArchiveMatch ?? false,
    archiveConfidence: metadata.archiveConfidence,
    hasApprovedFacts: metadata.hasApprovedFacts ?? false,
    schemeId: metadata.schemeId,
    citations,
  };
  
  const policy = getGroundingPolicy(intent);
  
  if (!policy.requiresGrounding) {
    const specificityCheck = detectUngroundedSpecificity(answerText);
    if (specificityCheck.hasUngroundedClaims && !isSourceGrounded(groundingContext, policy)) {
      return {
        safeAnswerText: stripUngroundedClaims(answerText, specificityCheck.patterns),
        modified: true,
        violationType: 'specificity_without_grounding',
        violations: specificityCheck.patterns,
        groundingContext,
      };
    }
    
    return {
      safeAnswerText: answerText,
      modified: false,
      groundingContext,
    };
  }
  
  const isGrounded = isSourceGrounded(groundingContext, policy);
  
  if (isGrounded) {
    return {
      safeAnswerText: answerText,
      modified: false,
      groundingContext,
    };
  }
  
  const specificityCheck = detectUngroundedSpecificity(answerText);
  
  if (specificityCheck.hasUngroundedClaims) {
    return {
      safeAnswerText: policy.fallbackMessage,
      modified: true,
      violationType: policy.violationType,
      violations: specificityCheck.patterns,
      groundingContext,
    };
  }
  
  if (isAmenitiesIntent(intent) && !groundingContext.hasPlacesData) {
    if (containsVenueNames(answerText)) {
      return {
        safeAnswerText: policy.fallbackMessage,
        modified: true,
        violationType: 'amenities_without_places',
        violations: ['venue_names_without_places'],
        groundingContext,
      };
    }
  }
  
  if (isLocalFactsIntent(intent) && !groundingContext.hasApprovedFacts && !groundingContext.hasArchiveMatch) {
    if (containsHistoricalClaims(answerText)) {
      return {
        safeAnswerText: policy.fallbackMessage,
        modified: true,
        violationType: 'local_facts_ungrounded',
        violations: ['historical_claims_without_source'],
        groundingContext,
      };
    }
  }
  
  return {
    safeAnswerText: answerText,
    modified: false,
    groundingContext,
  };
}

function mapSourceToGroundedType(
  source: string,
  metadata: FirewallInput['metadata']
): GroundingContext['sourceType'] {
  if (metadata?.isPlaybook) {
    return 'deterministic_playbook';
  }
  if (metadata?.isSchemeProfile) {
    return 'scheme_profile_data';
  }
  if (metadata?.hasPlacesData) {
    return 'google_places';
  }
  if (metadata?.hasArchiveMatch) {
    return 'smart_archive_docs';
  }
  if (metadata?.hasApprovedFacts) {
    return 'developer_entered_facts';
  }
  
  switch (source) {
    case 'semantic_search':
    case 'rag':
    case 'smart_archive':
      return 'smart_archive_docs';
    case 'places':
    case 'google_places':
      return 'google_places';
    case 'playbook':
      return 'deterministic_playbook';
    case 'scheme_profile':
      return 'scheme_profile_data';
    case 'area_facts':
      return 'developer_entered_facts';
    default:
      return 'general_knowledge';
  }
}

function isAmenitiesIntent(intent: string): boolean {
  const amenitiesKeywords = ['amenities', 'nearby', 'places', 'local_services', 'restaurants', 'cafes', 'shops', 'gyms', 'parks'];
  return amenitiesKeywords.some(k => intent.toLowerCase().includes(k));
}

function isLocalFactsIntent(intent: string): boolean {
  const factsKeywords = ['local_area_fact', 'area_trivia', 'local_history', 'did_you_know', 'neighbourhood'];
  return factsKeywords.some(k => intent.toLowerCase().includes(k));
}

const VENUE_NAME_PATTERNS = [
  /\b(The|O'|Mc|Mac)?[A-Z][a-z]+('s)?\s+(Cafe|Restaurant|Bar|Pub|Shop|Store|Bistro|Kitchen|Deli|Bakery|Pharmacy|Gym|Fitness)\b/,
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(Cafe|Restaurant|Bar|Pub|Shop|Store)\b/,
  /\b(Costa|Starbucks|Tesco|Dunnes|SuperValu|Aldi|Lidl|Centra|Spar|Insomnia)\b/i,
];

function containsVenueNames(text: string): boolean {
  return VENUE_NAME_PATTERNS.some(pattern => pattern.test(text));
}

const HISTORICAL_CLAIM_PATTERNS = [
  /\b(historically|traditionally|originally|anciently)\b/i,
  /\b(founded|established|built|constructed)\s+(in|around|circa)\s+\d{4}\b/i,
  /\b(dates\s+back|dating\s+back)\s+to\b/i,
  /\b(named\s+after|in\s+honour\s+of)\s+[A-Z]/,
  /\b(famous|renowned|known)\s+for\s+(its|the|being)\b/i,
  /\bcentur(y|ies)\s+(old|ago)\b/i,
];

function containsHistoricalClaims(text: string): boolean {
  return HISTORICAL_CLAIM_PATTERNS.some(pattern => pattern.test(text));
}

function stripUngroundedClaims(text: string, patterns: string[]): string {
  let result = text;
  
  for (const pattern of patterns) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`[^.]*${escaped}[^.]*\\.?\\s*`, 'gi');
    result = result.replace(regex, '');
  }
  
  result = result.replace(/\s+/g, ' ').trim();
  
  if (result.length < 20) {
    return "I don't have verified information about that specific detail. Is there something else I can help you with?";
  }
  
  return result;
}

export function getFirewallDiagnostics(result: FirewallResult): Record<string, unknown> {
  return {
    firewall_modified: result.modified,
    violation_type: result.violationType ?? null,
    violations: result.violations ?? [],
    source_type: result.groundingContext?.sourceType ?? 'unknown',
    has_places_data: result.groundingContext?.hasPlacesData ?? false,
    has_archive_match: result.groundingContext?.hasArchiveMatch ?? false,
    archive_confidence: result.groundingContext?.archiveConfidence ?? null,
    has_approved_facts: result.groundingContext?.hasApprovedFacts ?? false,
  };
}
