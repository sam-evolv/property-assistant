/**
 * Assistant Operating System (OS)
 * 
 * Central governance layer for the OpenHouse AI assistant that:
 * - Classifies user intent
 * - Enforces source priority (structured data > smart archive > google places > playbooks > escalation)
 * - Handles emergency triage (Tier 1/2/3)
 * - Manages warranty boundaries
 * - Prevents hallucinations through grounded responses
 */

export type IntentType =
  | 'scheme_fact'
  | 'unit_fact'
  | 'document_answer'
  | 'location_amenities'
  | 'how_to_playbook'
  | 'sensitive_subjective'
  | 'emergency'
  | 'affirmative'
  | 'humor'
  | 'unknown';

export type AnswerMode = 'grounded' | 'guided' | 'neutral';

export type SourceType =
  | 'scheme_profile'
  | 'unit_profile'
  | 'smart_archive'
  | 'google_places'
  | 'playbook'
  | 'escalation'
  | 'none';

export type EmergencyTier = 1 | 2 | 3 | null;

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  keywords: string[];
  emergencyTier: EmergencyTier;
}

export interface AnswerStrategy {
  mode: AnswerMode;
  sourcePriority: SourceType[];
  requiresEscalation: boolean;
  escalationReason?: string;
}

export interface AssistantResponse {
  content: string;
  source: SourceType;
  isGrounded: boolean;
  metadata: {
    intent: IntentType;
    answerMode: AnswerMode;
    emergencyTier: EmergencyTier;
    sourcesChecked: SourceType[];
    unknownFields?: string[];
  };
}

const TIER_1_PATTERNS = [
  /\b(fire|burning|flames?|smoke)\b.*\b(in|from|coming|see|smell)\b/i,
  /\bsmell(s|ing)?\s*(of\s*)?(gas|burning)\b/i,
  /\bgas\s*(leak|smell|coming)\b/i,
  /\bspark(s|ing)\b.*\b(socket|plug|wire|outlet|electrical)\b/i,
  /\belectric(al)?\s*(shock|shocked|zapped)\b/i,
  /\bgot\s+(a\s+)?shock\s+from\b/i,
  /\belectrocuted\b/i,
  /\bflood(ing|ed)?\b.*\b(near|by|around)\b.*\b(socket|plug|wire|electric|fuse)\b/i,
  /\bwater\b.*\b(near|by|around|touching)\b.*\b(electric|socket|fuse)\b/i,
  /\b(collapse|collapsing|collapsed)\b.*\b(ceiling|roof|floor|wall)\b/i,
  /\bcarbon\s*monoxide\b/i,
  /\bco\s*(alarm|detector)\b.*\b(going\s+off|beeping|sounding)\b/i,
];

const TIER_2_PATTERNS = [
  /\b(major|big|serious|severe)\s*(leak|flooding)\b/i,
  /\bburst\s*pipe\b/i,
  /\bpipe\s*(has\s*)?(burst|broken)\b/i,
  /\bwater\s*(everywhere|flooding|pouring)\b/i,
  /\bno\s+(heating|hot\s+water)\b.*\b(cold|freezing|winter)\b/i,
  /\bheating\s*(not\s+working|broken|failed)\b.*\b(cold|freezing)\b/i,
  /\bboiler\s*(broken|failed|not\s+working)\b/i,
  /\b(fire|smoke)\s*alarm\b.*\b(fault|broken|not\s+working|beeping)\b/i,
  /\balarm\s*(keeps?\s*)?(beeping|chirping|going\s+off)\b/i,
  /\bpower\s*(outage|out|cut|failure)\b/i,
  /\bno\s+(power|electricity)\b/i,
  /\block(ed)?\s*out\b/i,
  /\bsecurity\s*(alarm|issue|breach)\b/i,
];

const TIER_3_PATTERNS = [
  /\b(small|minor)\s*(leak|drip)\b/i,
  /\b(crack|cracks)\s+(in|on)\s*(wall|ceiling)\b/i,
  /\b(damp|mould|mold)\s*(spot|patch|area)\b/i,
  /\b(scratch|scuff|mark|stain)\b/i,
  /\b(door|window|handle|hinge)\s*(stuck|stiff|loose)\b/i,
  /\bsnagging\b/i,
  /\bdefect(s|ive)?\b/i,
  /\breport\s*(a\s*)?(issue|problem|defect)\b/i,
];

const SCHEME_FACT_PATTERNS = [
  /\b(development|scheme|estate)\s*(name|address|postcode|location)\b/i,
  /\bwho\s*(is|are)\s*(the\s*)?(developer|builder|managing\s*agent)\b/i,
  /\b(management|service)\s*(company|fee|charge)\b/i,
  /\b(bin|refuse|recycling)\s*(day|collection)\b/i,
  /\b(parking|visitor)\s*(rules?|permit|policy)\b/i,
  /\b(communal|shared)\s*(areas?|facilities?|amenities?)\b/i,
  /\b(gym|pool|concierge|reception)\s*(hours?|access|location)\b/i,
];

const UNIT_FACT_PATTERNS = [
  /\b(my|our)\s*(home|house|flat|apartment|unit)\b/i,
  /\b(my|our)\s*(bedroom|bathroom|kitchen|living\s*room)\b/i,
  /\b(floor\s*plan|layout|sqft|square\s*(feet|metres|meters))\b/i,
  /\b(my|our)\s*(boiler|thermostat|heating|ventilation)\b/i,
  /\bhow\s*(do|does)\s*(my|the)\b/i,
];

const DOCUMENT_ANSWER_PATTERNS = [
  /\bwhere\s*(can|do)\s*(i|we)\s*find\b/i,
  /\b(manual|guide|instructions?|documentation)\b/i,
  /\b(warranty|guarantee)\s*(document|certificate|details?)\b/i,
  /\b(certificate|certification)\s*(of|for)\b/i,
  /\bshow\s*me\s*(the|my)\b/i,
  /\b(download|get|access)\s*(the|my)?\s*(document|file|pdf)\b/i,
];

const AMENITY_TYPES = 'supermarket|grocery|shop|store|pharmacy|chemist|doctor|gp|hospital|dentist|school|nursery|gym|restaurant|cafe|pub|bar|bank|atm|post\\s*office|train|bus|tube|station|creche|montessori|childcare|preschool|medical|health\\s*cent(?:re|er)|park|playground|leisure|swimming|pool|sports|fitness|golf|golf\\s*course|golf\\s*club|cinema|movie\\s*theat(?:re|er)|pictures|films?';

const LOCATION_PATTERNS = [
  /\bnearest\s*(to\s*(me|us|here))?\b/i,
  /\bnearby\b/i,
  /\bclose\s*(to|by)\b/i,
  /\bclosest\b/i,
  /\bnear\s+me\b/i,
  /\bwhere\s*(is|are)\s*(the\s*)?(nearest|closest)\b/i,
  /\bwhat'?s?\s*(around|nearby|close\s*by)\b/i,
  /\blocal\s*(amenities?|facilities?|shops?|services?|area)\b/i,
  /\bnear\s*(me|here|us|the\s*(development|estate|scheme))\b/i,
  new RegExp(`\\b(nearest|closest)\\s+(${AMENITY_TYPES})\\b`, 'i'),
  new RegExp(`\\b(${AMENITY_TYPES})\\s+(nearby|near\\s*(me|here|us)|close\\s*by|closest|nearest)\\b`, 'i'),
  new RegExp(`\\bwhere\\s+(is|are|can\\s+i\\s+find)\\s+(the\\s+)?(nearest|closest)\\s+(${AMENITY_TYPES})\\b`, 'i'),
  new RegExp(`\\b(what|which)\\s+(${AMENITY_TYPES})s?\\s+(are|is)\\s+(nearby|near\\s*(me|here)|close)\\b`, 'i'),
];

const PLAYBOOK_PATTERNS = [
  /\bhow\s*(do|to|can)\s*(i|we)?\b/i,
  /\bwhat\s*(should|do)\s*(i|we)\s*(do|use)\b/i,
  /\bstep(s|\s*by\s*step)?\b/i,
  /\binstructions?\s*(for|on|to)\b/i,
  /\b(operate|use|set\s*up|configure|adjust)\b/i,
  /\b(tips?|advice|recommend)\b/i,
];

const SENSITIVE_PATTERNS = [
  /\b(should\s*i|is\s*it\s*worth|do\s*you\s*think)\b/i,
  /\b(opinion|recommend|suggest|advice\s*on)\b/i,
  /\b(complain|complaint|dispute|disagree)\b/i,
  /\b(refund|compensation|legal|sue|lawyer|solicitor)\b/i,
  /\b(neighbours?|neighbors?)\s*(noise|party|dispute|issue|problem)\b/i,
  /\b(contractor|builder)\s*(quality|bad|poor|issue)\b/i,
];

const AFFIRMATIVE_PATTERNS = [
  /^yes\.?$/i,
  /^yeah\.?$/i,
  /^yep\.?$/i,
  /^sure\.?$/i,
  /^please\.?$/i,
  /^ok(ay)?\.?$/i,
  /^yes,?\s*please\.?$/i,
  /^that would be (great|helpful|nice)\.?$/i,
  /^i('d| would) like that\.?$/i,
  /^go ahead\.?$/i,
];

const HUMOR_PATTERNS = [
  /tell\s*(me\s*)?(a\s*)?joke/i,
  /say\s*something\s*funny/i,
  /make\s*me\s*laugh/i,
  /got\s*(any\s*)?jokes/i,
  /know\s*(any\s*)?jokes/i,
  /be\s*funny/i,
  /do\s*you\s*have\s*(a\s*)?(sense\s*of\s*)?humo(u)?r/i,
  /cheer\s*me\s*up/i,
  /lighten\s*the\s*mood/i,
  /anything\s*funny/i,
  /crack\s*(a\s*)?joke/i,
  /humor\s*me/i,
  /^joke$/i,
  /^funny$/i,
];

export function isHumorRequest(message: string): boolean {
  const trimmed = message.trim();
  return HUMOR_PATTERNS.some(p => p.test(trimmed));
}

export function isAffirmativeResponse(message: string): boolean {
  const trimmed = message.trim();
  return AFFIRMATIVE_PATTERNS.some(p => p.test(trimmed));
}

const WARRANTY_APPLIANCE_KEYWORDS = [
  'dishwasher', 'washing machine', 'washer', 'dryer', 'tumble dryer',
  'fridge', 'freezer', 'refrigerator', 'microwave', 'oven', 'hob', 'cooker',
  'extractor', 'hood', 'fan', 'air conditioning', 'ac unit', 'radiator',
];

const WARRANTY_STRUCTURAL_KEYWORDS = [
  'roof', 'wall', 'ceiling', 'floor', 'foundation', 'structure', 'structural',
  'window', 'door', 'frame', 'damp', 'crack', 'subsidence', 'insulation',
  'plumbing', 'drainage', 'electrical', 'wiring', 'boiler', 'heating system',
];

export function classifyIntent(message: string): IntentClassification {
  const lower = message.toLowerCase();
  const foundKeywords: string[] = [];
  
  // Check for short affirmative responses first (e.g., "yes", "sure", "please")
  // These should route to the previous follow-up suggestion
  if (isAffirmativeResponse(message)) {
    return {
      intent: 'affirmative',
      confidence: 0.95,
      keywords: ['affirmative', 'follow-up-acceptance'],
      emergencyTier: null,
    };
  }
  
  const emergencyTier = detectEmergencyTier(message);
  if (emergencyTier === 1) {
    return {
      intent: 'emergency',
      confidence: 0.95,
      keywords: ['emergency', 'tier-1'],
      emergencyTier: 1,
    };
  }
  if (emergencyTier === 2) {
    return {
      intent: 'emergency',
      confidence: 0.9,
      keywords: ['emergency', 'tier-2'],
      emergencyTier: 2,
    };
  }
  if (emergencyTier === 3) {
    return {
      intent: 'emergency',
      confidence: 0.8,
      keywords: ['maintenance', 'tier-3'],
      emergencyTier: 3,
    };
  }
  
  if (matchesPatterns(message, SENSITIVE_PATTERNS)) {
    return {
      intent: 'sensitive_subjective',
      confidence: 0.8,
      keywords: ['sensitive', 'subjective'],
      emergencyTier: emergencyTier,
    };
  }
  
  // EXCEPTION: "public transport" questions should NOT go to Google Places - use document search instead
  // Transport docs contain detailed bus route info that Google Places doesn't have
  const isPublicTransportQuestion = /\b(public\s*transport|transport\s*options?|bus\s*routes?|bus\s*services?)\b/i.test(lower);
  
  if (matchesPatterns(message, LOCATION_PATTERNS) && !isPublicTransportQuestion) {
    return {
      intent: 'location_amenities',
      confidence: 0.85,
      keywords: extractMatchingKeywords(lower, ['nearest', 'nearby', 'local', 'close']),
      emergencyTier: emergencyTier,
    };
  }
  
  if (matchesPatterns(message, SCHEME_FACT_PATTERNS)) {
    return {
      intent: 'scheme_fact',
      confidence: 0.85,
      keywords: extractMatchingKeywords(lower, ['development', 'scheme', 'management', 'parking']),
      emergencyTier: emergencyTier,
    };
  }
  
  if (matchesPatterns(message, UNIT_FACT_PATTERNS)) {
    return {
      intent: 'unit_fact',
      confidence: 0.85,
      keywords: extractMatchingKeywords(lower, ['my', 'home', 'flat', 'boiler', 'heating']),
      emergencyTier: emergencyTier,
    };
  }
  
  if (matchesPatterns(message, DOCUMENT_ANSWER_PATTERNS)) {
    return {
      intent: 'document_answer',
      confidence: 0.8,
      keywords: extractMatchingKeywords(lower, ['document', 'manual', 'guide', 'warranty', 'certificate']),
      emergencyTier: emergencyTier,
    };
  }
  
  if (matchesPatterns(message, PLAYBOOK_PATTERNS)) {
    return {
      intent: 'how_to_playbook',
      confidence: 0.75,
      keywords: extractMatchingKeywords(lower, ['how', 'operate', 'use', 'steps']),
      emergencyTier: emergencyTier,
    };
  }
  
  return {
    intent: 'unknown',
    confidence: 0.3,
    keywords: foundKeywords,
    emergencyTier: emergencyTier,
  };
}

export function detectEmergencyTier(message: string): EmergencyTier {
  if (matchesPatterns(message, TIER_1_PATTERNS)) {
    return 1;
  }
  if (matchesPatterns(message, TIER_2_PATTERNS)) {
    return 2;
  }
  if (matchesPatterns(message, TIER_3_PATTERNS)) {
    return 3;
  }
  return null;
}

export function getAnswerStrategy(intent: IntentClassification): AnswerStrategy {
  switch (intent.intent) {
    case 'emergency':
      if (intent.emergencyTier === 1) {
        return {
          mode: 'grounded',
          sourcePriority: ['escalation'],
          requiresEscalation: true,
          escalationReason: 'life_safety_emergency',
        };
      }
      if (intent.emergencyTier === 2) {
        return {
          mode: 'grounded',
          sourcePriority: ['scheme_profile', 'escalation'],
          requiresEscalation: true,
          escalationReason: 'property_emergency',
        };
      }
      return {
        mode: 'guided',
        sourcePriority: ['scheme_profile', 'smart_archive', 'playbook'],
        requiresEscalation: false,
      };
      
    case 'scheme_fact':
      return {
        mode: 'grounded',
        sourcePriority: ['scheme_profile', 'smart_archive'],
        requiresEscalation: false,
      };
      
    case 'unit_fact':
      return {
        mode: 'grounded',
        sourcePriority: ['unit_profile', 'scheme_profile', 'smart_archive'],
        requiresEscalation: false,
      };
      
    case 'document_answer':
      return {
        mode: 'grounded',
        sourcePriority: ['smart_archive', 'scheme_profile'],
        requiresEscalation: false,
      };
      
    case 'location_amenities':
      return {
        mode: 'guided',
        sourcePriority: ['google_places', 'scheme_profile'],
        requiresEscalation: false,
      };
      
    case 'how_to_playbook':
      return {
        mode: 'guided',
        sourcePriority: ['smart_archive', 'playbook', 'scheme_profile'],
        requiresEscalation: false,
      };
      
    case 'sensitive_subjective':
      return {
        mode: 'neutral',
        sourcePriority: ['escalation'],
        requiresEscalation: true,
        escalationReason: 'sensitive_topic',
      };
      
    default:
      return {
        mode: 'guided',
        sourcePriority: ['smart_archive', 'scheme_profile', 'playbook'],
        requiresEscalation: false,
      };
  }
}

export function getTier1Response(): string {
  return `This sounds like an emergency that could involve immediate risk to health or safety.

Please take these steps now:
1. If you smell gas, do not use any electrical switches or open flames. Leave the property immediately and call 999 or 112 from outside.
2. If there is fire or smoke, leave the building immediately via the nearest safe exit. Do not use lifts. Call 999 or 112 once safely outside.
3. If there is electrical sparking or you have received a shock, switch off at the main fuse box if safe to do so, and do not touch affected areas. Call 999 if anyone is injured.
4. If there is flooding near electrical equipment, switch off at the main fuse box if safe, then call emergency services.

Do not rely on this assistant for emergency guidance. Call 999 or 112 for immediate help.`;
}

export function getTier2Response(schemeEmergencyContact?: string): string {
  const contactInfo = schemeEmergencyContact
    ? `Please contact your scheme emergency line: ${schemeEmergencyContact}`
    : 'Please contact your managing agent or developer emergency contact. These details should be in your homeowner welcome pack or displayed in communal areas.';

  return `This appears to be a property emergency that needs urgent attention.

${contactInfo}

If you cannot reach them and the situation is getting worse (e.g., water spreading, temperatures becoming dangerous), consider calling 999 or 112.

For out-of-hours emergencies, check your homeowner documentation for emergency contact numbers.`;
}

export function getTier3Response(): string {
  return `This sounds like a non-urgent maintenance issue that should be reported through the standard channels.

You can typically report this via:
- Your homeowner portal (if available)
- The snagging or defects reporting process
- Contacting your managing agent during office hours

Would you like help finding the relevant contact details or reporting process?`;
}

export function detectWarrantyType(message: string): 'appliance' | 'structural' | 'unknown' {
  const lower = message.toLowerCase();
  
  for (const keyword of WARRANTY_APPLIANCE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'appliance';
    }
  }
  
  for (const keyword of WARRANTY_STRUCTURAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'structural';
    }
  }
  
  return 'unknown';
}

export function getWarrantyGuidance(warrantyType: 'appliance' | 'structural' | 'unknown'): string {
  switch (warrantyType) {
    case 'appliance':
      return `Appliance warranties are typically provided by the manufacturer or retailer. Check your appliance documentation for warranty terms and contact details. The developer's warranty usually does not cover appliance faults.`;
    case 'structural':
      return `Home defects and structural issues are typically covered under your developer warranty or NHBC/similar structural warranty. Check your homeowner documentation for the warranty terms and reporting process.`;
    default:
      return `Warranty coverage depends on the type of issue. Appliances are usually covered by manufacturer warranties, while home defects and structural issues are covered by the developer or NHBC warranty. Check your documentation for specific terms.`;
  }
}

export function formatSourceMetadata(source: SourceType): string {
  const sourceLabels: Record<SourceType, string> = {
    scheme_profile: 'Scheme Profile',
    unit_profile: 'Unit Profile',
    smart_archive: 'Smart Archive',
    google_places: 'Google Places',
    playbook: 'Playbook',
    escalation: 'Escalation Required',
    none: 'No Source',
  };
  return sourceLabels[source] || source;
}

export function buildUngroundedResponse(intent: IntentType, unknownFields: string[]): string {
  const fieldList = unknownFields.length > 0 
    ? unknownFields.join(', ')
    : 'the specific information you asked about';
    
  return `I do not have verified information about ${fieldList} in the available scheme data or documents. 

To get accurate information, you could:
- Check your homeowner welcome pack or manual
- Contact your managing agent or developer directly
- Look in your online homeowner portal (if available)

I can help you find contact details if that would be useful.`;
}

function matchesPatterns(message: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(message));
}

function extractMatchingKeywords(lower: string, keywords: string[]): string[] {
  return keywords.filter(kw => lower.includes(kw));
}

export function isAssistantOSEnabled(): boolean {
  return process.env.FEATURE_ASSISTANT_OS !== 'false';
}
