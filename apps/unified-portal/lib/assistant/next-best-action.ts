/**
 * Proactive Next Best Action System
 * 
 * Generates capability-safe follow-up suggestions at the end of responses.
 * Only suggests actions the system can actually fulfil.
 * 
 * CONSTRAINTS:
 * - Disabled for emergencies and safety intercepts
 * - Never produces dead-end follow-ups
 * - Respects feature flags
 * - Crisp, non-spammy tone
 */

import { 
  CapabilityType, 
  Capability, 
  IntentCapability, 
  getCapabilityForIntent,
  getRelatedIntents,
  CAPABILITY_MAP 
} from './capability-map';

export interface CapabilityContext {
  docs_available: boolean;
  scheme_location: boolean;
  places_api: boolean;
  session_memory: boolean;
  unit_info: boolean;
  floor_plans: boolean;
  drawings: boolean;
  local_history: boolean;
}

export interface NextBestActionResult {
  shouldSuggest: boolean;
  suggestions: string[];
  intent: string | null;
  gateReason?: string;
}

const BLOCKED_INTENTS = [
  'emergency',
  'emergency_tier1',
  'emergency_tier2',
  'emergency_tier3',
  'safety_intercept',
  'gdpr_blocked',
];

const BLOCKED_SOURCES = [
  'emergency_tier1',
  'emergency_tier2',
  'maintenance_tier3',
  'safety_intercept',
  'gdpr_protection',
];

export function isNextBestActionEnabled(): boolean {
  return process.env.ASSISTANT_NEXT_BEST_ACTION === 'true';
}

export function shouldBlockSuggestions(intent: string | null, source: string | null): boolean {
  if (intent && BLOCKED_INTENTS.includes(intent)) return true;
  if (source && BLOCKED_SOURCES.includes(source)) return true;
  return false;
}

export function buildCapabilityContext(options: {
  hasDocuments: boolean;
  hasSchemeLocation: boolean;
  placesApiWorking: boolean;
  hasSessionMemory: boolean;
  hasUnitInfo: boolean;
  hasFloorPlans: boolean;
  hasDrawings: boolean;
  isLongviewOrRathard: boolean;
}): CapabilityContext {
  return {
    docs_available: options.hasDocuments,
    scheme_location: options.hasSchemeLocation,
    places_api: options.placesApiWorking,
    session_memory: options.hasSessionMemory,
    unit_info: options.hasUnitInfo,
    floor_plans: options.hasFloorPlans,
    drawings: options.hasDrawings,
    local_history: options.isLongviewOrRathard,
  };
}

export function checkCapabilitiesMet(
  required: CapabilityType[], 
  context: CapabilityContext
): { met: boolean; missing: CapabilityType[] } {
  const missing: CapabilityType[] = [];
  
  for (const cap of required) {
    if (!context[cap]) {
      missing.push(cap);
    }
  }
  
  return {
    met: missing.length === 0,
    missing
  };
}

export function getNextBestAction(
  intent: string | null,
  source: string | null,
  context: CapabilityContext,
  maxSuggestions: number = 2
): NextBestActionResult {
  // Check if feature is enabled
  if (!isNextBestActionEnabled()) {
    return {
      shouldSuggest: false,
      suggestions: [],
      intent,
      gateReason: 'feature_disabled'
    };
  }
  
  // Block for emergencies and safety
  if (shouldBlockSuggestions(intent, source)) {
    return {
      shouldSuggest: false,
      suggestions: [],
      intent,
      gateReason: 'blocked_intent_or_source'
    };
  }
  
  // If no intent detected, use general suggestions
  const effectiveIntent = intent || 'general';
  
  // Get capability for this intent
  const capability = getCapabilityForIntent(effectiveIntent);
  
  if (!capability) {
    // Try related intents or fall back to general
    const generalCap = CAPABILITY_MAP.find(c => c.intent === 'general');
    if (generalCap) {
      const check = checkCapabilitiesMet(generalCap.requires, context);
      if (check.met) {
        return {
          shouldSuggest: true,
          suggestions: generalCap.suggestions.slice(0, maxSuggestions),
          intent: effectiveIntent,
        };
      }
    }
    
    return {
      shouldSuggest: false,
      suggestions: [],
      intent: effectiveIntent,
      gateReason: 'no_capability_match'
    };
  }
  
  // Check if required capabilities are met
  const check = checkCapabilitiesMet(capability.requires, context);
  
  if (!check.met) {
    // Try related intents
    const related = getRelatedIntents(effectiveIntent);
    for (const relatedIntent of related) {
      const relatedCap = getCapabilityForIntent(relatedIntent);
      if (relatedCap) {
        const relatedCheck = checkCapabilitiesMet(relatedCap.requires, context);
        if (relatedCheck.met) {
          return {
            shouldSuggest: true,
            suggestions: relatedCap.suggestions.slice(0, maxSuggestions),
            intent: relatedIntent,
          };
        }
      }
    }
    
    return {
      shouldSuggest: false,
      suggestions: [],
      intent: effectiveIntent,
      gateReason: `missing_capabilities: ${check.missing.join(', ')}`
    };
  }
  
  return {
    shouldSuggest: true,
    suggestions: capability.suggestions.slice(0, maxSuggestions),
    intent: effectiveIntent,
  };
}

export function formatNextBestAction(suggestions: string[], style: 'inline' | 'bullets' = 'inline'): string {
  if (suggestions.length === 0) return '';
  
  if (style === 'bullets' && suggestions.length > 1) {
    return '\n\nNext steps:\n- ' + suggestions.join('\n- ');
  }
  
  // Inline style - just append one suggestion naturally
  if (suggestions.length === 1) {
    return '\n\n' + suggestions[0];
  }
  
  // For 2 suggestions, pick one randomly or use the first
  return '\n\n' + suggestions[0];
}

export function appendNextBestAction(
  response: string,
  intent: string | null,
  source: string | null,
  context: CapabilityContext
): { response: string; suggestionUsed: string | null; debugInfo: NextBestActionResult } {
  const result = getNextBestAction(intent, source, context);
  
  if (!result.shouldSuggest || result.suggestions.length === 0) {
    return {
      response,
      suggestionUsed: null,
      debugInfo: result
    };
  }
  
  // Pick one suggestion (could randomize later)
  const suggestionIndex = Math.floor(Math.random() * Math.min(result.suggestions.length, 2));
  const suggestion = result.suggestions[suggestionIndex];
  
  // Append to response
  const enhancedResponse = response.trim() + '\n\n' + suggestion;
  
  return {
    response: enhancedResponse,
    suggestionUsed: suggestion,
    debugInfo: result
  };
}

// ============================================================================
// INTENT DETECTION FROM MESSAGE (for cases where intent isn't classified)
// ============================================================================

const INTENT_PATTERNS: { intent: string; patterns: RegExp[] }[] = [
  {
    intent: 'heating',
    patterns: [
      /\b(heat(?:ing)?|radiator|thermostat|warm|cold|temperature)\b/i,
    ]
  },
  {
    intent: 'boiler',
    patterns: [
      /\b(boiler|hot\s*water|immersion)\b/i,
    ]
  },
  {
    intent: 'heat_pump',
    patterns: [
      /\b(heat\s*pump|air\s*to\s*water|a2w)\b/i,
    ]
  },
  {
    intent: 'snagging',
    patterns: [
      /\b(snag(?:ging)?|defect|punch\s*list)\b/i,
    ]
  },
  {
    intent: 'warranty',
    patterns: [
      /\b(warranty|warranties|homebond|guarantee)\b/i,
    ]
  },
  {
    intent: 'amenities',
    patterns: [
      /\b(shop|cafe|restaurant|pub|gym|supermarket|pharmacy|nearby|local)\b/i,
    ]
  },
  {
    intent: 'schools',
    patterns: [
      /\b(school|primary|secondary|education)\b/i,
    ]
  },
  {
    intent: 'bins',
    patterns: [
      /\b(bin|waste|recycl|rubbish|garbage)\b/i,
    ]
  },
  {
    intent: 'contacts',
    patterns: [
      /\b(contact|who\s*do\s*i|phone|email|call)\b/i,
    ]
  },
];

export function detectIntentFromMessage(message: string): string | null {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return intent;
      }
    }
  }
  return null;
}
