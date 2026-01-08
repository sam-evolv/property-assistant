/**
 * Grounding Policy for Hallucination Firewall
 * 
 * Defines allowed source types for factual claims and validation rules
 * to prevent the assistant from making ungrounded statements.
 */

export type GroundedSourceType = 
  | 'smart_archive_docs'      // RAG with validated match and confidence >= threshold
  | 'google_places'           // Places API results with distance matrix
  | 'deterministic_playbook'  // Playbook templates with no generated content
  | 'scheme_profile_data'     // Explicit scheme setup fields from database
  | 'developer_entered_facts' // Approved facts from area_facts table
  | 'general_knowledge'       // Generic advice only - no scheme-specific claims
  | 'none';                   // No grounding available

export interface GroundingContext {
  sourceType: GroundedSourceType;
  confidence?: number;
  hasPlacesData?: boolean;
  hasArchiveMatch?: boolean;
  archiveConfidence?: number;
  hasApprovedFacts?: boolean;
  schemeId?: string;
  citations?: string[];
}

export interface GroundingPolicy {
  requiresGrounding: boolean;
  allowedSources: GroundedSourceType[];
  fallbackMessage: string;
  violationType: string;
}

const CONFIDENCE_THRESHOLD = 0.65;

const LOCATION_AMENITIES_INTENTS = [
  'amenities',
  'location_amenities',
  'nearby_places',
  'local_services',
  'restaurants',
  'cafes',
  'shops',
  'gyms',
  'parks',
  'pharmacies',
  'supermarkets',
];

const LOCAL_FACTS_INTENTS = [
  'local_area_fact',
  'area_trivia',
  'local_history',
  'neighbourhood_info',
  'area_facts',
  'did_you_know',
];

const GENERIC_ADVICE_INTENTS = [
  'utilities_setup',
  'moving_tips',
  'general_advice',
  'how_to',
  'ireland_info',
  'general',
];

export function getGroundingPolicy(intent: string): GroundingPolicy {
  const normalizedIntent = intent.toLowerCase().trim();
  
  if (LOCATION_AMENITIES_INTENTS.some(i => normalizedIntent.includes(i))) {
    return {
      requiresGrounding: true,
      allowedSources: ['google_places', 'scheme_profile_data'],
      fallbackMessage: "I'd be happy to help you find places nearby. What type of place are you looking for? For example, I can search for cafes, restaurants, shops, schools, or other local services.",
      violationType: 'amenities_without_places',
    };
  }
  
  if (LOCAL_FACTS_INTENTS.some(i => normalizedIntent.includes(i))) {
    return {
      requiresGrounding: true,
      allowedSources: ['developer_entered_facts', 'smart_archive_docs'],
      fallbackMessage: "I don't have a verified local history note for this development yet. Would you like me to help with nearby amenities or local services instead?",
      violationType: 'local_facts_ungrounded',
    };
  }
  
  if (GENERIC_ADVICE_INTENTS.some(i => normalizedIntent.includes(i))) {
    return {
      requiresGrounding: false,
      allowedSources: ['general_knowledge', 'smart_archive_docs', 'deterministic_playbook'],
      fallbackMessage: '',
      violationType: 'none',
    };
  }
  
  return {
    requiresGrounding: true,
    allowedSources: ['smart_archive_docs', 'google_places', 'deterministic_playbook', 'scheme_profile_data', 'developer_entered_facts'],
    fallbackMessage: "I don't have specific information about that in your home documentation. Would you like me to help with something else?",
    violationType: 'general_ungrounded',
  };
}

export function isSourceGrounded(
  context: GroundingContext,
  policy: GroundingPolicy
): boolean {
  if (!policy.requiresGrounding) {
    return true;
  }
  
  for (const allowedSource of policy.allowedSources) {
    switch (allowedSource) {
      case 'smart_archive_docs':
        if (context.hasArchiveMatch && (context.archiveConfidence ?? 0) >= CONFIDENCE_THRESHOLD) {
          return true;
        }
        break;
      case 'google_places':
        if (context.hasPlacesData) {
          return true;
        }
        break;
      case 'developer_entered_facts':
        if (context.hasApprovedFacts) {
          return true;
        }
        break;
      case 'scheme_profile_data':
      case 'deterministic_playbook':
        if (context.sourceType === allowedSource) {
          return true;
        }
        break;
      case 'general_knowledge':
        if (context.sourceType === 'general_knowledge') {
          return true;
        }
        break;
    }
  }
  
  return false;
}

const UNGROUNDED_SPECIFICITY_PATTERNS = [
  /\b(1[0-9]{3}|20[0-2][0-9])\b/,
  /\b(1[0-9]th|18th|19th|20th|21st)\s+century\b/i,
  /\b(founded|established|built|opened)\s+in\s+\d{4}\b/i,
  /\b(largest|oldest|first|biggest|smallest)\s+(in\s+)?(the\s+)?(world|ireland|europe|country)\b/i,
  /\b(exactly|precisely)\s+\d+\s+(minutes?|meters?|metres?|km|miles?)\b/i,
  /\b\d+\s*(am|pm)\s*(-|to|until)\s*\d+\s*(am|pm)\b/i,
  /\b(open|opens|closes|closed)\s+(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm)?\b/i,
  /\b(walk|drive|cycle)\s+of\s+(exactly\s+)?\d+\s+(minutes?|mins?)\b/i,
  /\bhistorically\s+(known|famous|renowned)\s+for\b/i,
  /\bnamed\s+after\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
];

export function detectUngroundedSpecificity(text: string): {
  hasUngroundedClaims: boolean;
  patterns: string[];
} {
  const matchedPatterns: string[] = [];
  
  for (const pattern of UNGROUNDED_SPECIFICITY_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        matchedPatterns.push(match[0]);
      }
    }
  }
  
  return {
    hasUngroundedClaims: matchedPatterns.length > 0,
    patterns: matchedPatterns,
  };
}

export function isAreaFactsEnabled(): boolean {
  return process.env.ASSISTANT_AREA_FACTS === 'true';
}

export function isHallucinationFirewallEnabled(): boolean {
  return process.env.ASSISTANT_HALLUCINATION_FIREWALL === 'true';
}

export { CONFIDENCE_THRESHOLD };
