import { NextRequest, NextResponse } from 'next/server';
import { getRelevantHomeKnowledge, formatHomeKnowledgeContext } from '@/lib/assistant/home-knowledge';

// ---------------------------------------------------------------------------
// MODEL ROUTER — simple tasks → gpt-4.1-mini, complex tasks → gpt-4o
// ---------------------------------------------------------------------------
const SIMPLE_MODEL = 'gpt-4.1-mini';
const COMPLEX_MODEL = 'gpt-4o';

const COMPLEX_INTENT_KEYWORDS = [
  'explain', 'why', 'how does', 'how do', 'what causes', 'what is',
  'difference between', 'compare', 'diagnose', 'troubleshoot', 'problem with',
  'not working', "doesn't work", 'broken', 'fault', 'issue with', 'leaking',
  'damp', 'mould', 'crack', 'noise', 'smell', 'structural', 'warranty',
  'coverage', 'who covers', 'who is responsible', 'should i', 'can i',
];

const SAFETY_INTENTS = [
  'emergency', 'gas_leak', 'fire', 'flood', 'structural_movement',
  'electrical_fault', 'carbon_monoxide',
];

function selectChatModel(
  message: string,
  chunks: { similarity?: number }[],
  intentKey: string | null
): string {
  const lower = message.toLowerCase();

  // Always use full model for safety/emergency intents
  if (intentKey && SAFETY_INTENTS.some(s => intentKey.includes(s))) {
    return COMPLEX_MODEL;
  }

  // Complex if warranty type is structural or appliance (nuanced guidance needed)
  const warrantyType = detectWarrantyType(message);
  if (warrantyType !== 'unknown') return COMPLEX_MODEL;

  // Complex if question is long (detailed multi-part question)
  if (message.length > 200) return COMPLEX_MODEL;

  // Complex if multiple relevant chunks — requires synthesis across documents
  const relevantChunks = chunks.filter(c => (c.similarity ?? 0) >= 0.35);
  if (relevantChunks.length >= 3) return COMPLEX_MODEL;

  // Complex if explanation/diagnosis keywords present
  if (COMPLEX_INTENT_KEYWORDS.some(kw => lower.includes(kw))) return COMPLEX_MODEL;

  // Simple: short factual question, 0-2 chunks, no complexity signals
  return SIMPLE_MODEL;
}
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { messages, units } from '@openhouse/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { extractQuestionTopic } from '@/lib/question-topic-extractor';
import { findDrawingForQuestion, ResolvedDrawing } from '@/lib/drawing-resolver';
import { detectDocumentLinkRequest, findDocumentForLink, findFloorPlanDocuments, ResolvedDocument, FloorPlanAttachment } from '@/lib/document-link-resolver';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { createErrorLogger, logAnalyticsEvent } from '@openhouse/api';
import { getUnitInfo, UnitInfo } from '@/lib/unit-lookup';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { generateRequestId, createStructuredError, logCritical, getResponseHeaders } from '@/lib/api-error-utils';
import { 
  classifyIntent, 
  getAnswerStrategy, 
  getTier1Response, 
  getTier2Response, 
  getTier3Response,
  detectWarrantyType,
  getWarrantyGuidance,
  isAssistantOSEnabled,
  isHumorRequest,
  type IntentClassification,
  type AnswerStrategy,
} from '@/lib/assistant/os';
import { formatJokeResponse } from '@/lib/assistant/jokes';
import { isYesIntent } from '@/lib/assistant/local-history';
import { 
  isSessionMemoryEnabled, 
  getSessionMemory, 
  updateSessionFromMessage, 
  getMemoryContext, 
  hasRelevantMemory,
  getMemoryDebugInfo,
  type SessionMemory,
  type MemoryDebugInfo
} from '@/lib/assistant/session-memory';
import {
  isNextBestActionEnabled,
  buildCapabilityContext,
  appendNextBestAction,
  detectIntentFromMessage,
  type CapabilityContext,
  type NextBestActionResult
} from '@/lib/assistant/next-best-action';
import {
  isEscalationEnabled,
  shouldTriggerEscalation,
  routeEscalation,
  formatEscalationGuidance,
  type SchemeContacts,
  type EscalationOutput
} from '@/lib/assistant/escalation';
import {
  isToneGuardrailsEnabled,
  wrapResponse,
  shouldBlockHumor,
  processStreamedResponse,
  createStreamingGuardrail,
  type ResponseStyleInput,
} from '@/lib/assistant/response-style';
import { isLongviewOrRathardScheme as checkIsLongviewOrRathard } from '@/lib/assistant/local-history';
import { 
  getIntentPlaybook, 
  buildIntentSystemPrompt, 
  applyGlobalSafetyContract,
  GLOBAL_SAFETY_CONTRACT
} from '@/lib/assistant/suggested-pills';
import { getNearbyPOIs, formatPOIResponse, formatShopsResponse, formatGroupedSchoolsResponse, formatLocalAmenitiesResponse, detectPOICategoryExpanded, isLocationMissingReason, dedupeAndFillAmenities, buildStaticMapUrl, type POICategory, type FormatPOIOptions, type POIResult, type GroupedSchoolsData, type GroupedAmenitiesData } from '@/lib/places/poi';
import { getTransitRoutes, formatTransitRoutesResponse, getActiveTravelTimes, formatActiveTravelResponse } from '@/lib/transport/routes';
import { getWeather, formatWeatherResponse } from '@/lib/weather/met-eireann';
import { detectAmenityHallucinations } from '@/lib/assistant/amenity-answer-validator';
import { 
  enforceGrounding, 
  getFirewallDiagnostics,
  type FirewallInput,
  type FirewallResult
} from '@/lib/assistant/hallucination-firewall';
import { isHallucinationFirewallEnabled } from '@/lib/assistant/grounding-policy';
import { cleanForDisplay } from '@/lib/assistant/formatting';
import { isEscalationAllowedForIntent } from '@/lib/assistant/escalation';
import { globalCache } from '@/lib/cache/ttl-cache';
// SEAI grants interceptor removed — RAG pipeline handles all questions now
// Utility wizard interceptor removed — RAG pipeline handles all questions now

function generateFollowUpQuestions(intent: string, message: string): string[] {
  const msg = message.toLowerCase();
  const followUps: Record<string, string[]> = {
    location_amenities: ['What schools are nearby?', 'Are there parks close by?', 'What supermarkets are within walking distance?'],
    weather: ['What\'s the forecast for the weekend?', 'Is there a weather warning for Cork?'],
    transport: ['How long would it take to cycle to town?', 'Are there trains to Dublin from here?'],
    snagging: ['How do I report a snag to my developer?', 'What\'s covered under my structural warranty?'],
    warranty: ['How long does my structural warranty last?', 'Who do I contact to make a warranty claim?'],
    heat_pump: ['What temperature should I set my heat pump to?', 'How often does a heat pump need servicing?'],
    mvhr: ['How often should I clean the MVHR filters?', 'Can I turn off my MVHR unit?'],
    ber: ['What does my BER rating mean for heating costs?', 'How do I look up my home\'s BER certificate?'],
    documents: ['Can I download my warranty documents?', 'Where do I find my BER certificate?'],
    local_history: ['What facilities are planned for the development?', 'Who manages the estate?'],
    management_company: ['How do I pay my service charge?', 'Who is responsible for maintaining communal areas?'],
    grants: ['Am I eligible for the SEAI home energy grant?', 'How do I apply for the EV charger grant?'],
    maintenance: ['What home maintenance should I do in spring?', 'How often should I service my heat pump?'],
    utilities: ['How do I switch electricity supplier?', 'How do I register my meter with Irish Water?'],
  };

  // Try exact intent match first
  if (followUps[intent]) {
    return followUps[intent].slice(0, 2);
  }

  // Try keyword matching on message
  if (msg.includes('school') || msg.includes('creche') || msg.includes('childcare')) return ['What secondary schools are in the area?', 'Are there creches near the development?'];
  if (msg.includes('supermarket') || msg.includes('shop') || msg.includes('grocery')) return ['What pharmacies are nearby?', 'Are there restaurants close by?'];
  if (msg.includes('park') || msg.includes('walk') || msg.includes('outdoor')) return ['Are there schools nearby?', 'How far is the city centre?'];
  if (msg.includes('bus') || msg.includes('train') || msg.includes('commute')) return ['How long does it take to walk to the bus stop?', 'Are there cycle lanes on the route to town?'];
  if (msg.includes('heat') || msg.includes('heating') || msg.includes('boiler')) return ['How do I service my heat pump?', 'What\'s the best heating schedule for an A-rated home?'];
  if (msg.includes('crack') || msg.includes('leak') || msg.includes('damp')) return ['How do I report this to my developer?', 'Is this covered under my structural warranty?'];

  // Generic fallback
  return ['What documents do I have in my portal?', 'What amenities are near my home?'];
}

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || '127.0.0.1';
}

const CONVERSATION_HISTORY_LIMIT = 8; // Load last 8 exchanges for context

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// SMART ROOM MATCHING SYSTEM
// Maps user phrases to possible database room keys to search for
// Each entry has: displayName (for response), searchKeys (room_key values to try in DB), searchNames (room_name patterns for ILIKE)

interface RoomMapping {
  displayName: string;
  searchKeys: string[];  // Exact room_key values to search in DB
  searchNames: string[]; // Patterns for ILIKE search on room_name
}

// Comprehensive mapping of how users might ask about rooms
const ROOM_PHRASE_MAPPINGS: Array<{ patterns: RegExp[]; mapping: RoomMapping }> = [
  // KITCHEN/DINING - must check compound terms first
  {
    patterns: [/\bkitchen\s*[\/&-]\s*dining\b/i, /\bkitchen\s+dining\b/i, /\bopen\s*plan\s*kitchen\b/i],
    mapping: {
      displayName: 'Kitchen/Dining',
      searchKeys: ['kitchen_dining', 'kitchen/dining', 'Kitchen/Dining', 'kitchen-dining', 'Kitchen Dining', 'kitchen dining'],
      searchNames: ['kitchen%dining', 'kitchen/dining', 'open plan']
    }
  },

  // KITCHEN alone - but also try kitchen/dining as fallback
  {
    patterns: [/\bkitchen\b/i],
    mapping: {
      displayName: 'Kitchen',
      searchKeys: ['kitchen', 'Kitchen', 'kitchen_dining', 'kitchen/dining', 'Kitchen/Dining'],
      searchNames: ['kitchen']
    }
  },

  // LIVING ROOM - many variations
  {
    patterns: [
      /\bliving\s*room\b/i, /\bsitting\s*room\b/i, /\blounge\b/i, /\bfront\s*room\b/i,
      /\btv\s*room\b/i, /\btelevision\s*room\b/i, /\bliving\s*area\b/i, /\breception\s*room\b/i,
      /\bfamily\s*room\b/i, /\bden\b/i, /\bparlour\b/i, /\bparlor\b/i
    ],
    mapping: {
      displayName: 'Living Room',
      searchKeys: ['living_room', 'living room', 'Living Room', 'lounge', 'Lounge', 'sitting_room', 'sitting room', 'Sitting Room'],
      searchNames: ['living', 'lounge', 'sitting', 'reception']
    }
  },

  // MASTER/MAIN BEDROOM
  {
    patterns: [/\b(?:master|main|primary)\s*bedroom\b/i, /\bmaster\b/i, /\bmain\s*bed\b/i],
    mapping: {
      displayName: 'Master Bedroom',
      searchKeys: ['bedroom_1', 'bedroom 1', 'Bedroom 1', 'master_bedroom', 'master bedroom', 'Master Bedroom', 'bedroom1', 'Bedroom1'],
      searchNames: ['master', 'bedroom 1', 'bedroom1', 'main bedroom']
    }
  },

  // BEDROOM with numbers
  {
    patterns: [/\bbedroom\s*(?:1|one)\b/i, /\b(?:first|1st)\s*bedroom\b/i],
    mapping: {
      displayName: 'Bedroom 1',
      searchKeys: ['bedroom_1', 'bedroom 1', 'Bedroom 1', 'bedroom1', 'Bedroom1'],
      searchNames: ['bedroom 1', 'bedroom1']
    }
  },
  {
    patterns: [/\bbedroom\s*(?:2|two)\b/i, /\b(?:second|2nd)\s*bedroom\b/i],
    mapping: {
      displayName: 'Bedroom 2',
      searchKeys: ['bedroom_2', 'bedroom 2', 'Bedroom 2', 'bedroom2', 'Bedroom2'],
      searchNames: ['bedroom 2', 'bedroom2']
    }
  },
  {
    patterns: [/\bbedroom\s*(?:3|three)\b/i, /\b(?:third|3rd)\s*bedroom\b/i],
    mapping: {
      displayName: 'Bedroom 3',
      searchKeys: ['bedroom_3', 'bedroom 3', 'Bedroom 3', 'bedroom3', 'Bedroom3'],
      searchNames: ['bedroom 3', 'bedroom3']
    }
  },
  {
    patterns: [/\bbedroom\s*(?:4|four)\b/i, /\b(?:fourth|4th)\s*bedroom\b/i],
    mapping: {
      displayName: 'Bedroom 4',
      searchKeys: ['bedroom_4', 'bedroom 4', 'Bedroom 4', 'bedroom4', 'Bedroom4'],
      searchNames: ['bedroom 4', 'bedroom4']
    }
  },

  // DOWNSTAIRS WC/TOILET - specific
  {
    patterns: [
      /\bdownstairs\s*(?:wc|toilet|loo|bathroom|cloakroom)\b/i,
      /\bground\s*floor\s*(?:wc|toilet|loo|bathroom)\b/i,
      /\bwc\s*(?:downstairs|ground)\b/i,
      /\bcloakroom\b/i, /\bguest\s*(?:wc|toilet|loo)\b/i
    ],
    mapping: {
      displayName: 'Downstairs WC',
      searchKeys: ['wc_ground', 'wc_downstairs', 'WC Downstairs', 'wc downstairs', 'downstairs_wc', 'downstairs wc', 'Downstairs WC', 'toilet', 'Toilet', 'wc', 'WC', 'cloakroom', 'Cloakroom', 'guest_wc', 'guest wc'],
      searchNames: ['wc', 'downstairs', 'toilet', 'cloakroom', 'guest']
    }
  },

  // UPSTAIRS WC/TOILET - specific
  {
    patterns: [
      /\bupstairs\s*(?:wc|toilet|loo|bathroom)\b/i,
      /\b(?:first|1st)\s*floor\s*(?:wc|toilet|loo|bathroom)\b/i,
      /\bwc\s*(?:upstairs|first\s*floor)\b/i,
      /\bbathroom\s*(?:upstairs|first\s*floor)\b/i,
    ],
    mapping: {
      displayName: 'Upstairs Bathroom',
      searchKeys: ['wc_first', 'wc_upstairs', 'WC Upstairs', 'wc upstairs', 'upstairs_wc', 'upstairs wc', 'Upstairs WC', 'wc', 'WC'],
      searchNames: ['wc', 'upstairs', 'first floor', 'bathroom']
    }
  },

  // GENERIC WC/TOILET
  {
    patterns: [/\bwc\b/i, /\btoilet\b/i, /\bloo\b/i, /\bpowder\s*room\b/i],
    mapping: {
      displayName: 'WC',
      searchKeys: ['wc', 'WC', 'toilet', 'Toilet', 'wc_downstairs', 'WC Downstairs', 'wc_upstairs', 'WC Upstairs', 'cloakroom', 'Cloakroom'],
      searchNames: ['wc', 'toilet', 'loo', 'cloakroom']
    }
  },

  // ENSUITE - handle all variations: ensuite, en-suite, en suite, en suit
  {
    patterns: [
      /\ben[\s-]?suite\b/i,     // matches: ensuite, en-suite, en suite
      /\ben[\s-]?suit\b/i,      // matches: ensuit, en-suit, en suit (typo)
      /\bmaster\s*bath(?:room)?\b/i
    ],
    mapping: {
      displayName: 'Ensuite',
      searchKeys: ['ensuite', 'Ensuite', 'en-suite', 'En-suite', 'en_suite', 'En Suite', 'en suite', 'master_bathroom', 'master bathroom'],
      searchNames: ['ensuite', 'en-suite', 'en suite', 'master bath']
    }
  },

  // BATHROOM (main/family)
  {
    patterns: [/\b(?:main|family|upstairs)?\s*bathroom\b/i],
    mapping: {
      displayName: 'Bathroom',
      searchKeys: ['bathroom', 'Bathroom', 'main_bathroom', 'main bathroom', 'Main Bathroom', 'family_bathroom', 'family bathroom'],
      searchNames: ['bathroom']
    }
  },

  // UTILITY
  {
    patterns: [/\butility(?:\s*room)?\b/i, /\blaundry(?:\s*room)?\b/i, /\bboot\s*room\b/i],
    mapping: {
      displayName: 'Utility',
      searchKeys: ['utility', 'Utility', 'utility_room', 'utility room', 'Utility Room', 'laundry', 'Laundry'],
      searchNames: ['utility', 'laundry']
    }
  },

  // HALL/ENTRANCE
  {
    patterns: [/\b(?:entrance\s*)?hall(?:way)?\b/i, /\bfoyer\b/i, /\bvestibule\b/i, /\bentrance\b/i],
    mapping: {
      displayName: 'Hall',
      searchKeys: ['hall', 'Hall', 'hallway', 'Hallway', 'entrance_hall', 'entrance hall', 'Entrance Hall', 'entrance', 'Entrance'],
      searchNames: ['hall', 'entrance', 'foyer']
    }
  },

  // LANDING
  {
    patterns: [/\blanding\b/i],
    mapping: {
      displayName: 'Landing',
      searchKeys: ['landing', 'Landing', 'upstairs_landing', 'upstairs landing'],
      searchNames: ['landing']
    }
  },

  // DINING ROOM (separate)
  {
    patterns: [/\bdining\s*(?:room|area)?\b/i],
    mapping: {
      displayName: 'Dining Room',
      searchKeys: ['dining', 'Dining', 'dining_room', 'dining room', 'Dining Room', 'kitchen_dining', 'kitchen/dining'],
      searchNames: ['dining']
    }
  },

  // STUDY/OFFICE
  {
    patterns: [/\bstudy\b/i, /\b(?:home\s*)?office\b/i, /\bbox\s*room\b/i, /\bwork\s*room\b/i],
    mapping: {
      displayName: 'Study',
      searchKeys: ['study', 'Study', 'office', 'Office', 'home_office', 'home office', 'box_room', 'box room'],
      searchNames: ['study', 'office', 'box room']
    }
  },

  // GARAGE
  {
    patterns: [/\bgarage\b/i, /\bcar\s*port\b/i],
    mapping: {
      displayName: 'Garage',
      searchKeys: ['garage', 'Garage', 'carport', 'Carport'],
      searchNames: ['garage', 'carport']
    }
  },

  // HOT PRESS
  {
    patterns: [/\bhot\s*press\b/i, /\bhotpress\b/i, /\bairing\s*cupboard\b/i, /\bboiler\s*(?:room|cupboard)?\b/i],
    mapping: {
      displayName: 'Hot Press',
      searchKeys: ['hotpress', 'Hotpress', 'hot_press', 'hot press', 'Hot Press', 'airing_cupboard', 'airing cupboard'],
      searchNames: ['hot press', 'hotpress', 'airing', 'boiler']
    }
  },

  // STORAGE
  {
    patterns: [/\bstorage(?:\s*(?:room|cupboard|area))?\b/i, /\bcupboard\b/i, /\bwardrobe\b/i, /\bcloset\b/i],
    mapping: {
      displayName: 'Storage',
      searchKeys: ['storage', 'Storage', 'storage_room', 'storage room', 'cupboard', 'Cupboard'],
      searchNames: ['storage', 'cupboard']
    }
  },

  // Generic BEDROOM fallback (if no number specified)
  {
    patterns: [/\bbedroom\b/i, /\bbed\s*room\b/i],
    mapping: {
      displayName: 'Bedroom',
      searchKeys: ['bedroom_1', 'bedroom 1', 'Bedroom 1', 'bedroom_2', 'bedroom 2', 'Bedroom 2', 'bedroom', 'Bedroom'],
      searchNames: ['bedroom']
    }
  },
];

function extractRoomFromQuestion(question: string): RoomMapping | null {
  const lowerQuestion = question.toLowerCase();

  // Check patterns in order (more specific patterns are listed first in the array)
  for (const { patterns, mapping } of ROOM_PHRASE_MAPPINGS) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuestion)) {
        return mapping;
      }
    }
  }

  return null;
}

// Look up room dimensions from Supabase
interface RoomDimensionResult {
  found: boolean;
  roomName?: string;
  roomKey?: string;  // The actual room_key from the database record
  length_m?: number;
  width_m?: number;
  area_sqm?: number;
  ceiling_height_m?: number;
  verified?: boolean;
  source?: string;
}

// Smart room dimension lookup using the new RoomMapping system
async function lookupRoomDimensions(
  supabase: ReturnType<typeof getSupabaseClient>,
  tenantId: string,
  developmentId: string,
  houseTypeCode: string | undefined,
  unitId: string | undefined,
  roomMapping: RoomMapping
): Promise<RoomDimensionResult> {
  try {

    // First, get the house_type_id from unit_types table if we have a house type code
    // CRITICAL: Must filter by development (project_id) to avoid matching wrong house type!
    let houseTypeId: string | undefined;
    if (houseTypeCode && developmentId) {
      const { data: unitTypeData } = await supabase
        .from('unit_types')
        .select('id')
        .eq('name', houseTypeCode)
        .eq('project_id', developmentId)  // CRITICAL: Filter by development!
        .limit(1);

      if (unitTypeData && unitTypeData.length > 0) {
        houseTypeId = unitTypeData[0].id;
      } else {
      }
    }

    // Helper to parse dimension result
    const parseDimension = (dim: { room_name: string; room_key: string; length_m?: string | null; width_m?: string | null; area_sqm?: string | null; ceiling_height_m?: string | null; verified?: boolean; source?: string }): RoomDimensionResult => ({
      found: true,
      roomName: dim.room_name,
      roomKey: dim.room_key,  // Include the actual room_key for debugging
      length_m: dim.length_m ? parseFloat(dim.length_m) : undefined,
      width_m: dim.width_m ? parseFloat(dim.width_m) : undefined,
      area_sqm: dim.area_sqm ? parseFloat(dim.area_sqm) : undefined,
      ceiling_height_m: dim.ceiling_height_m ? parseFloat(dim.ceiling_height_m) : undefined,
      verified: dim.verified,
      source: dim.source,
    });

    // STRATEGY 1: Try all searchKeys with exact match on room_key
    for (const searchKey of roomMapping.searchKeys) {
      // Try unit-specific first
      if (unitId) {
        const { data } = await supabase
          .from('unit_room_dimensions')
          .select('room_name, room_key, length_m, width_m, area_sqm, ceiling_height_m, verified, source')
          .eq('tenant_id', tenantId)
          .eq('unit_id', unitId)
          .eq('room_key', searchKey)
          .order('verified', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          return parseDimension(data[0]);
        }
      }

      // Try house-type level
      if (houseTypeId) {
        const { data } = await supabase
          .from('unit_room_dimensions')
          .select('room_name, room_key, length_m, width_m, area_sqm, ceiling_height_m, verified, source')
          .eq('tenant_id', tenantId)
          .eq('house_type_id', houseTypeId)
          .eq('room_key', searchKey)
          .is('unit_id', null)
          .order('verified', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          return parseDimension(data[0]);
        }
      }

      // Try development-wide defaults (only records WITHOUT a specific house_type_id)
      // CRITICAL: Do NOT return other house types' dimensions - that causes wrong data!
      const { data } = await supabase
        .from('unit_room_dimensions')
        .select('room_name, room_key, length_m, width_m, area_sqm, ceiling_height_m, verified, source')
        .eq('tenant_id', tenantId)
        .eq('development_id', developmentId)
        .eq('room_key', searchKey)
        .is('house_type_id', null)  // IMPORTANT: Only match truly development-wide defaults
        .is('unit_id', null)        // And not unit-specific either
        .order('verified', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return parseDimension(data[0]);
      }
    }

    // STRATEGY 2: Try ILIKE search on room_name for each searchName pattern
    for (const searchName of roomMapping.searchNames) {
      // Try unit-specific first
      if (unitId) {
        const { data } = await supabase
          .from('unit_room_dimensions')
          .select('room_name, room_key, length_m, width_m, area_sqm, ceiling_height_m, verified, source')
          .eq('tenant_id', tenantId)
          .eq('unit_id', unitId)
          .ilike('room_name', `%${searchName}%`)
          .order('verified', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          return parseDimension(data[0]);
        }
      }

      // Try house-type level
      if (houseTypeId) {
        const { data } = await supabase
          .from('unit_room_dimensions')
          .select('room_name, room_key, length_m, width_m, area_sqm, ceiling_height_m, verified, source')
          .eq('tenant_id', tenantId)
          .eq('house_type_id', houseTypeId)
          .ilike('room_name', `%${searchName}%`)
          .is('unit_id', null)
          .order('verified', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          return parseDimension(data[0]);
        }
      }

      // Try development-wide defaults (only records WITHOUT a specific house_type_id)
      // CRITICAL: Do NOT return other house types' dimensions - that causes wrong data!
      const { data } = await supabase
        .from('unit_room_dimensions')
        .select('room_name, room_key, length_m, width_m, area_sqm, ceiling_height_m, verified, source')
        .eq('tenant_id', tenantId)
        .eq('development_id', developmentId)
        .ilike('room_name', `%${searchName}%`)
        .is('house_type_id', null)  // Only truly development-wide defaults
        .is('unit_id', null)
        .order('verified', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return parseDimension(data[0]);
      }
    }

    // STRATEGY 3: Try ILIKE on room_key as well (in case room_key has the display name format)
    // Only match development-wide defaults (no house_type_id set)
    for (const searchName of roomMapping.searchNames) {
      const { data } = await supabase
        .from('unit_room_dimensions')
        .select('room_name, room_key, length_m, width_m, area_sqm, ceiling_height_m, verified, source')
        .eq('tenant_id', tenantId)
        .eq('development_id', developmentId)
        .ilike('room_key', `%${searchName}%`)
        .is('house_type_id', null)  // Only truly development-wide defaults
        .is('unit_id', null)
        .order('verified', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return parseDimension(data[0]);
      }
    }

    return { found: false };
  } catch (err) {
    return { found: false };
  }
}

function formatRoomDimensionAnswer(dim: RoomDimensionResult, roomName: string, hasFloorPlanAttachments: boolean = false): string {
  if (!dim.found) {
    if (hasFloorPlanAttachments) {
      return `I don't have the specific dimensions for the ${roomName} stored yet. I've included the floor plan below which should have the accurate room measurements.`;
    }
    return `I don't have the specific dimensions for the ${roomName} stored yet. You can check your floor plan documents for exact measurements.`;
  }

  let answer = `Your ${dim.roomName || roomName} `;

  if (dim.length_m && dim.width_m) {
    answer += `measures approximately ${dim.length_m}m × ${dim.width_m}m`;
    if (dim.area_sqm) {
      answer += `, giving a floor area of ${dim.area_sqm} m²`;
    }
  } else if (dim.area_sqm) {
    answer += `has a floor area of approximately ${dim.area_sqm} m²`;
  } else {
    if (hasFloorPlanAttachments) {
      return `I don't have complete dimension data for the ${roomName}. I've included the floor plan below which should have the accurate measurements.`;
    }
    return `I don't have complete dimension data for the ${roomName}. You can check your floor plan documents for exact measurements.`;
  }

  if (dim.ceiling_height_m) {
    answer += ` with a ceiling height of ${dim.ceiling_height_m}m`;
  }

  answer += '.';

  // Add disclaimer - only mention floor plans if we're actually attaching them
  if (hasFloorPlanAttachments) {
    answer += '\n\nPlease note: These dimensions are provided as a guide only. For exact measurements, please refer to the official floor plans attached below.';
  } else {
    answer += '\n\nPlease note: These dimensions are provided as a guide only. For exact measurements, please refer to your official floor plan documents.';
  }

  return answer;
}

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

// MULTILINGUAL SUPPORT: Translate non-English queries to English for better RAG retrieval
// Documents are embedded in English, so queries should be in English for best semantic match
async function translateQueryToEnglish(query: string, sourceLanguage: string): Promise<string> {
  // Skip translation if already English
  if (sourceLanguage === 'en') {
    return query;
  }

  const translateStart = Date.now();
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a translator. Translate the following text to English. Return ONLY the translated text, nothing else. Preserve the intent and meaning exactly.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const translatedQuery = response.choices[0]?.message?.content?.trim() || query;
    return translatedQuery;
  } catch (err) {
    return query;
  }
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
const DEFAULT_DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
const MAX_CHUNKS = 8; // Limit context to top 8 most relevant chunks (optimized for speed)
const MAX_CONTEXT_CHARS = 32000; // Max characters in context (~8k tokens)

// Resilient message persistence - enforces unit_id for main flow
interface MessagePersistParams {
  tenant_id: string;
  development_id: string;
  unit_id?: string | null;  // SEV-1: Required for main flow, optional for early exits
  user_id?: string | null;  // Must be valid UUID or null
  unit_uid?: string | null;
  user_message: string;
  ai_message: string;
  question_topic: string;
  source: string;
  latency_ms: number;
  metadata: Record<string, unknown>;
  request_id?: string;
  require_unit_id?: boolean;  // SEV-1: Set true to enforce unit_id requirement
}

// Validate UUID format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str: string | null | undefined): boolean {
  return !!str && UUID_REGEX.test(str);
}

async function persistMessageSafely(params: MessagePersistParams): Promise<{ success: boolean; error?: string }> {
  try {
    // SEV-1 ENFORCEMENT: If require_unit_id is set, block if unit_id is invalid
    if (params.require_unit_id && !isValidUUID(params.unit_id)) {
      const errorMsg = `unit_id is required and must be a valid UUID. Got: ${params.unit_id}`;
      return { success: false, error: errorMsg };
    }
    
    const validUserId = isValidUUID(params.user_id) ? params.user_id! : null;
    const validUnitId = isValidUUID(params.unit_id) ? params.unit_id! : null;
    
    // Log warning if unit_id is missing (for analytics tracking)
    if (!validUnitId) {
    }
    
    await db.insert(messages).values({
      tenant_id: params.tenant_id,
      development_id: params.development_id,
      unit_id: validUnitId,
      user_id: validUserId,
      content: params.user_message,
      user_message: params.user_message,
      ai_message: params.ai_message,
      question_topic: params.question_topic,
      sender: 'conversation',
      source: params.source,
      token_count: 0,
      cost_usd: '0',
      latency_ms: params.latency_ms,
      metadata: {
        ...params.metadata,
        unitUid: params.unit_uid || null,
      },
    });
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

// SAFETY-CRITICAL PRE-FILTER: Intercept dangerous queries BEFORE they hit the LLM
// Uses both exact keywords and regex patterns for robust matching
function isSafetyCriticalQuery(message: string): { isCritical: boolean; matchedKeyword: string | null } {
  const lower = message.toLowerCase().replace(/['']/g, "'");

  const keywords = [
    "load bearing", "load-bearing", "loadbearing",
    "remove wall", "remove a wall", "remove the wall", "removing wall",
    "knock wall", "knock this wall", "knock down wall", "knock out wall",
    "tear down wall", "take out wall", "take down wall",
    "is this wall safe", "is the wall safe", "wall safe to",
    "safe to drill", "can i drill", "drill into wall", "drill into the wall", "drilling into",
    "gas leak", "smell of gas", "smells like gas", "smell gas", "smelling gas", "gas smell",
    "burning smell", "smell of burning", "smell smoke", "smells like burning", "something burning",
    "smells like it's burning", "smells like its burning", "like burning",
    "smoke coming from", "smoke from socket", "smoke from plug", "smoke from outlet",
    "smoke is coming", "smoke coming",
    "burning wire", "wire burning", "cable burning",
    "sparking", "sparks from", "electrical sparks", "arcing",
    "sparks are coming", "sparks coming",
    "electrical issue", "electrical problem", "electrical fault",
    "fuse tripping", "fuse keeps tripping", "breaker tripping", "breaker keeps tripping", "trips the fuse",
    "can i bypass", "bypass the", "bypass circuit",
    "fire risk", "fire hazard", "fire safety", "fire danger",
    "fire alarm", "smoke alarm", "smoke detector", "fire detector",
    "alarm keeps", "alarm beeping", "alarm chirping", "alarm going off",
    "mould", "mold", "black mould", "black mold", "mouldy", "moldy",
    "asbestos", "asbesto",
    "structural movement", "structural issue", "structural problem", "structural damage",
    "crack in wall", "cracks in wall", "crack in ceiling", "cracks in ceiling", "wall crack", "ceiling crack",
    "cracks appearing", "cracks in my ceiling", "ceiling cracks",
    "roof sagging", "sagging roof", "roof drooping", "ceiling sagging",
    "floor sagging", "floor seems to be sagging", "sagging floor",
    "leaking pipe", "pipe leaking", "burst pipe", "pipe burst", "pipe has burst",
    "major leak", "big leak", "serious leak", "water everywhere",
    "flooding", "flooded", "water flooding", "flooding in",
    "boiler issue", "boiler problem", "boiler not working", "boiler broken",
    "heating not working", "heating broken", "no heating", "no hot water",
    "heating won't work", "heating wont work", "radiators not working",
    "radiator leaking", "radiator leak",
    "gas boiler", "gas appliance", "gas cooker", "gas hob", "gas fire",
    "electrical socket", "plug socket", "power socket", "outlet problem",
    "wiring problem", "wiring issue", "faulty wiring", "old wiring",
    "wiring looks old", "wiring in my attic",
    "is it safe", "is this safe", "is it dangerous", "dangerous",
    "structural change", "structural work", "structural alteration",
    "carbon monoxide", "co alarm", "co detector", "co2 alarm", "monoxide detector", "monoxide alarm",
    "electrocuted", "electric shock", "got shocked", "zapped me",
    "got a shock", "got a shock from",
    "damp problem", "damp issue", "rising damp", "penetrating damp",
    "damp coming through", "damp on the wall", "damp through the wall",
    "water damage", "ceiling leak", "roof leak", "water coming through",
    "water is coming through", "leak in the ceiling",
    "party wall", "supporting wall", "can i remove", "can i knock",
    "subsidence", "foundation", "foundations", "ground movement"
  ];

  const patterns = [
    /\b(load[\s-]?bear|support(ing|ive)?\s+wall)\b/i,
    /\b(knock|remove|tear|take)\s*(down|out|through)?\s*(a|the|this)?\s*wall\b/i,
    /\bwall\s*(safe|ok|okay)\s*(to|for)\b/i,
    /\bdrill\s*(into|through|in)\b/i,
    /\b(smell|smelling|smells?)\s*(of\s*)?(gas|burning|smoke)\b/i,
    /\b(gas|smoke|burning)\s*smell\b/i,
    /\bsmoke\s*(is\s*)?(coming|from|out)\b/i,
    /\bspark(s|ing)?\s*(are\s*)?(from|coming)\b/i,
    /\b(fuse|breaker|circuit)\s*(keep|keeps)?\s*trip(ping|s)?\b/i,
    /\bbypass\s*(the|a)?\s*(fuse|breaker|circuit|safety)\b/i,
    /\b(fire|smoke|co|carbon\s*monoxide)\s*(alarm|detector)\b/i,
    /\balarm\s*(keep|keeps)?\s*(beep|chirp|sound|go)/i,
    /\b(mould|mold|mouldy|moldy)\b/i,
    /\bcracks?\s*(in|on|appearing)\s*(the\s*)?(my\s*)?(wall|ceiling|floor)\b/i,
    /\b(wall|ceiling|floor)\s*cracks?\b/i,
    /\b(roof|ceiling|floor)\s*(is\s*)?(sag|droop|bend|bow|seem)/i,
    /\bpipe\s*(has\s*)?(leak|burst|broke)\b/i,
    /\b(burst|broken|leaking)\s*pipe\b/i,
    /\bboiler\s*(not|isn't|isnt|won't|wont|broken|issue|problem)\b/i,
    /\b(no\s+)?(hot\s+water|heating)\s*(not\s+|won't\s+|wont\s+)?work/i,
    /\bheating\s+won'?t\s+work/i,
    /\belectric(al)?\s*(shock|socket|issue|problem|fault)\b/i,
    /\bgot\s+a\s+shock\s+from/i,
    /\bstructur(al|e)\s*(change|work|alteration|issue|problem|damage)\b/i,
    /\bcarbon\s*monoxide\b/i,
    /\bco\s*(alarm|detector|leak)\b/i,
    /\bsubsidence\b/i,
    /\bfoundation(s)?\s*(issue|problem|crack|damage)\b/i,
    /\b(is\s+)?(it|this|that)\s+(safe|dangerous|ok|okay)\b/i,
    /\bsafe\s+to\s+(drill|remove|knock|alter|change|modify)\b/i,
    /\bwiring\s*(in\s+my|looks?\s+old|is\s+old|frayed)\b/i,
    /\bdamp\s*(is\s*)?(coming|through)\b/i,
    /\bwater\s+is\s+coming\s+through\b/i,
    /\bsmells?\s+like\s+(it'?s?\s+)?burning\b/i,
    /\bsomething\s+smells?\s+like\b/i
  ];

  const matchedKeyword = keywords.find((kw) => lower.includes(kw));
  if (matchedKeyword) {
    return { isCritical: true, matchedKeyword };
  }

  for (const pattern of patterns) {
    if (pattern.test(message)) {
      return { isCritical: true, matchedKeyword: `pattern:${pattern.source.slice(0, 30)}` };
    }
  }

  return { isCritical: false, matchedKeyword: null };
}

// Standard safe response for safety-critical queries (bypasses LLM entirely)
const SAFETY_INTERCEPT_RESPONSE = `Thanks for flagging that, and I'm glad you asked. I cannot safely assess structural, electrical, gas, fire, or health risks from here. For anything that might affect safety or the structure of your home, you should contact a qualified professional such as your builder, management company, electrician, plumber, or relevant contractor.

If you believe there is any immediate risk to health, safety, or property (for example smells of gas, burning, sparking, major leak, or structural movement), please contact emergency services immediately on 999 or 112. Do not rely on this assistant for emergency guidance.

For non-urgent concerns, your homeowner manual includes contact details for reporting defects and maintenance issues. I'm happy to help you find that information if you'd like.`;

// HIGH-RISK TOPIC DETECTION: Detect safety/emergency questions that should not show document sources
function detectHighRiskTopic(message: string): { isHighRisk: boolean; category: string | null } {
  const messageLower = message.toLowerCase();
  
  // Emergency patterns - immediate danger
  if (/\b(emergency|ambulance|fire|choking|heart attack|can't breathe|bleeding|unconscious|999|112|help.*immediately)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'emergency' };
  }
  
  // Medical/health patterns
  if (/\b(hospital|doctor|gp|nhs|health|illness|sick|injured|injury|medical|symptoms?|diagnosis|prescription|medicine)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'medical' };
  }
  
  // Legal patterns
  if (/\b(solicitor|lawyer|legal|lawsuit|sue|court|contract dispute|liability|compensation|claim)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'legal' };
  }
  
  // Structural safety patterns
  if (/\b(crack|subsidence|structural|load.?bearing|foundation|collapse|dangerous.*building)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'structural' };
  }
  
  // Fire safety patterns  
  if (/\b(fire.*escape|fire.*alarm|smoke.*detector|fire.*door|fire.*safety|fire.*extinguisher)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'fire_safety' };
  }
  
  // Electrical/Gas safety patterns
  if (/\b(gas.*leak|gas.*smell|electric.*shock|electrical.*fault|boiler.*problem|carbon.*monoxide)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'electrical_gas' };
  }
  
  return { isHighRisk: false, category: null };
}

// GDPR PROTECTION: Detect questions about other residents' homes/units
function detectOtherUnitQuestion(message: string, userUnitAddress: string | null): { isAboutOtherUnit: boolean; mentionedUnit: string | null } {
  const messageLower = message.toLowerCase();
  
  // Patterns that indicate asking about a specific unit/address
  const unitPatterns = [
    /(?:number|no\.?|#|unit|house|flat|apartment)\s*(\d+)/gi,
    /(\d+)\s*(?:longview|park|street|road|avenue|lane|drive|close|way|court|gardens)/gi,
    /(?:my\s+)?neighbour'?s?\s+(?:house|home|unit|place)/gi,
    /(?:next\s+door|across\s+the\s+(?:road|street)|down\s+the\s+(?:road|street))/gi,
    /(?:who\s+lives?\s+(?:at|in)|what'?s?\s+(?:at|in))\s+(?:number|no\.?|#)?\s*\d+/gi,
    /(?:tell\s+me\s+about|information\s+(?:on|about))\s+(?:number|no\.?|#|unit|house)?\s*\d+/gi,
  ];
  
  let mentionedUnit: string | null = null;
  
  for (const pattern of unitPatterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      mentionedUnit = matches[0];
      
      // If user has a known address, check if they're asking about their OWN unit
      if (userUnitAddress) {
        const userAddressLower = userUnitAddress.toLowerCase();
        // Extract numbers from user's address
        const userUnitNumbers: string[] = userAddressLower.match(/\d+/g) || [];
        const mentionedNumbers: string[] = mentionedUnit.toLowerCase().match(/\d+/g) || [];
        
        // If the mentioned number matches the user's unit number, it's about THEIR home - allow it
        if (mentionedNumbers.length > 0 && userUnitNumbers.length > 0) {
          const firstMentioned = mentionedNumbers[0];
          if (firstMentioned && userUnitNumbers.includes(firstMentioned)) {
            return { isAboutOtherUnit: false, mentionedUnit: null };
          }
        }
      }
      
      return { isAboutOtherUnit: true, mentionedUnit };
    }
  }
  
  // Check for neighbour-related questions
  if (/\b(neighbour|neighbor|neighbours|neighbors|next\s*door|other\s+(unit|home|house|flat|apartment)s?)\b/i.test(messageLower)) {
    // Allow general community questions
    if (/\b(community|area|estate|development|scheme|facilities|amenities)\b/i.test(messageLower)) {
      return { isAboutOtherUnit: false, mentionedUnit: null };
    }
    // But block specific questions about neighbours' homes
    if (/\b(their|who|what|how\s+(big|large|many)|layout|floor\s*plan|bedrooms?|rooms?)\b/i.test(messageLower)) {
      return { isAboutOtherUnit: true, mentionedUnit: 'neighbour' };
    }
  }
  
  return { isAboutOtherUnit: false, mentionedUnit: null };
}

// Fetch user's unit details using shared dual-database lookup
// PERFORMANCE OPTIMIZATION: Cache unit lookups for 5 minutes (300000ms)
// Unit info rarely changes, and caching saves ~800-1200ms per request
async function getUserUnitDetails(unitUid: string): Promise<{ address: string | null; houseType: string | null; unitInfo: UnitInfo | null }> {
  if (!unitUid) return { address: null, houseType: null, unitInfo: null };

  const cacheKey = `unit_details:${unitUid}`;
  const cached = globalCache.get(cacheKey);
  if (cached) {
    return cached as { address: string | null; houseType: string | null; unitInfo: UnitInfo | null };
  }

  const lookupStart = Date.now();
  try {
    const unitInfo = await getUnitInfo(unitUid);

    if (!unitInfo) {
      const result = { address: null, houseType: null, unitInfo: null };
      // Cache negative results for shorter time (30 seconds)
      globalCache.set(cacheKey, result, 30000);
      return result;
    }

    const result = {
      address: unitInfo.address || null,
      houseType: unitInfo.house_type_code || null,
      unitInfo: unitInfo,
    };

    // Cache for 5 minutes
    globalCache.set(cacheKey, result, 300000);
    return result;
  } catch (err) {
    return { address: null, houseType: null, unitInfo: null };
  }
}

// Extract house type code from filename patterns
function extractHouseTypeFromFilename(filename: string): string | null {
  const patterns = [
    /House-Type-([A-Z]{1,3}\d{1,2})/i,  // House-Type-BD06
    /Type-([A-Z]{1,3}\d{1,2})/i,         // Type-BD06
    /[-_]([A-Z]{1,3}\d{1,2})[-_]/i,      // -BD06- or _BD06_
    /^([A-Z]{1,3}\d{1,2})[-_]/i,         // BD06- at start
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

// Get house type code from chunk metadata (checks multiple locations)
function getChunkHouseTypeCode(chunk: { metadata?: Record<string, unknown>; content?: string }): string | null {
  const metadata = chunk.metadata || {};
  const drawingClassification = (metadata.drawing_classification || {}) as Record<string, unknown>;
  const fileName = (metadata.file_name || metadata.source || '') as string;

  return (metadata.house_type_code as string | null) ||
         (drawingClassification.houseTypeCode as string | null) ||
         extractHouseTypeFromFilename(fileName);
}

// Parse embedding from Supabase (may be string, array, or object)
function parseEmbedding(emb: unknown): number[] | null {
  if (!emb) return null;
  
  // Already an array
  if (Array.isArray(emb)) return emb;
  
  // String format: "[0.1, 0.2, ...]" or "0.1,0.2,..."
  if (typeof emb === 'string') {
    try {
      // Try JSON parse first
      const parsed = JSON.parse(emb);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Try comma-separated format
      const cleaned = emb.replace(/[\[\]]/g, '').trim();
      if (cleaned) {
        const nums = cleaned.split(',').map(s => parseFloat(s.trim()));
        if (nums.length > 0 && !isNaN(nums[0])) return nums;
      }
    }
  }
  
  // Object with values property
  if (typeof emb === 'object' && emb.values) {
    return Array.isArray(emb.values) ? emb.values : null;
  }
  
  return null;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Clean markdown formatting from AI responses (remove asterisks, keep clean text)
function cleanMarkdownFormatting(text: string): string {
  return text
    // Remove bold/italic markdown: **text** or *text* -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove any remaining standalone asterisks used for bullets (replace with dash)
    .replace(/^\s*\*\s+/gm, '- ')
    // Clean up any double asterisks that might be left
    .replace(/\*\*/g, '')
    .replace(/\*/g, '');
}

// Check if message is a follow-up that needs context (must have pronouns/anaphora)
function isFollowUpQuestion(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  const wordCount = trimmed.split(/\s+/).length;
  
  // STRICT: Only treat as follow-up if it has anaphoric pronouns (referring to previous topic)
  const hasAnaphoricPronouns = /\b(them|they|it|its|those|these|the same)\b/i.test(trimmed);
  
  // Short messages with anaphoric pronouns definitely need context
  const isShort = wordCount <= 8;
  
  // Explicit follow-up patterns (not just any question)
  const followUpPatterns = [
    /^(and|but|also|what about|how about|tell me more|more info|more details)/i,
    /^(who|what|where|when|how|why)\s+(makes?|is|are|does|do|about)\s+(them|it|those|these)\b/i,
  ];
  
  const matchesExplicitPattern = followUpPatterns.some(p => p.test(trimmed));
  
  // Only return true if there are anaphoric pronouns or explicit follow-up patterns
  return (isShort && hasAnaphoricPronouns) || matchesExplicitPattern;
}

// Load recent conversation history for a user (only if properly identified)
async function loadConversationHistory(userId: string, tenantId: string, developmentId: string): Promise<{ userMessage: string; aiMessage: string }[]> {
  // SECURITY: Never load history for anonymous or unidentified users to prevent cross-session leakage
  if (!userId || userId === 'anonymous' || userId.length < 10) {
    return [];
  }
  
  try {
    // Scope history to specific user within tenant/development for isolation
    const recentMessages = await db
      .select({
        userMessage: messages.user_message,
        aiMessage: messages.ai_message,
        createdAt: messages.created_at,
      })
      .from(messages)
      .where(
        and(
          eq(messages.user_id, userId),
          eq(messages.tenant_id, tenantId),
          eq(messages.development_id, developmentId)
        )
      )
      .orderBy(desc(messages.created_at))
      .limit(CONVERSATION_HISTORY_LIMIT);
    
    // Reverse to get chronological order (oldest first)
    return recentMessages
      .filter(m => m.userMessage && m.aiMessage)
      .reverse()
      .map(m => ({
        userMessage: m.userMessage || '',
        aiMessage: m.aiMessage || '',
      }));
  } catch (error) {
    return [];
  }
}

/**
 * Chunk contextual compression — extracts the most relevant sentences from a chunk
 * rather than passing the full text. Keeps more signal in the context window.
 * Falls back to full chunk if extraction fails or chunk is short.
 */
function compressChunk(content: string, query: string): string {
  if (content.length < 400) return content; // Short chunks don't need compression

  const queryWords = new Set(
    query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  // Split into sentences (handle common abbreviations)
  const sentences = content
    .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 20);

  if (sentences.length <= 3) return content;

  // Score each sentence by keyword overlap with query
  const scored = sentences.map((sentence, idx) => {
    const words = sentence.toLowerCase().split(/\s+/);
    const overlap = words.filter(w => queryWords.has(w)).length;
    return { sentence, score: overlap, idx };
  });

  // Always include top 3 by relevance; preserve their original order
  const topIndices = new Set(
    [...scored]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.idx)
  );

  // Include one sentence before/after each top sentence for readability
  const includedIndices = new Set<number>();
  topIndices.forEach(i => {
    if (i > 0) includedIndices.add(i - 1);
    includedIndices.add(i);
    if (i < sentences.length - 1) includedIndices.add(i + 1);
  });

  const compressed = sentences
    .filter((_, i) => includedIndices.has(i))
    .join(' ');

  // Only use compressed version if it's meaningfully shorter
  return compressed.length < content.length * 0.75 ? compressed : content;
}

/**
 * Query expansion for retrieval — generates alternative phrasings so the
 * embedding search can match documents that use different terminology to the
 * user's question. E.g. "heat my house" → "heat pump operation guide".
 * Uses gpt-4.1-mini (cheap, fast). Falls back silently to original if it fails.
 */
async function expandQueryForRetrieval(message: string): Promise<string[]> {
  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You help improve document search for a property home assistant.
Given the homeowner's question, generate exactly 2 alternative phrasings that would match technical document language (e.g. manuals, guides, specifications, data sheets, product brochures).
Focus on product names, brands, technical specs, model numbers, and official terminology that appear in manufacturer documentation.
For example: "what brand of solar panels" should generate variants like "solar panel manufacturer specifications" and "photovoltaic system model datasheet".
Return only the 2 phrasings, one per line. No numbering, no explanation.`,
        },
        { role: 'user', content: message },
      ],
      max_tokens: 80,
      temperature: 0.2,
    });

    const alternatives = (completion.choices[0]?.message?.content ?? '')
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 5 && s.length < 300)
      .slice(0, 2);

    return alternatives.length > 0 ? [message, ...alternatives] : [message];
  } catch {
    return [message]; // silent fallback
  }
}

// Expand a follow-up query with context from previous messages
function expandQueryWithContext(currentMessage: string, history: { userMessage: string; aiMessage: string }[]): string {
  if (history.length === 0) return currentMessage;
  
  // Get the most recent exchange for context
  const lastExchange = history[history.length - 1];
  
  // Build a context-aware query for semantic search
  const contextQuery = `Previous topic: ${lastExchange.userMessage}\nCurrent question: ${currentMessage}`;
  
  return contextQuery;
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const clientIP = getClientIP(request);

  const rateCheck = checkRateLimit(clientIP, '/api/chat');
  if (!rateCheck.allowed) {
    return NextResponse.json(
      createStructuredError('Too many requests', requestId, {
        error_code: 'RATE_LIMITED',
        retryable: true,
      }),
      { status: 429, headers: { ...getResponseHeaders(requestId), 'retry-after': String(Math.ceil(rateCheck.resetMs / 1000)) } }
    );
  }

  const startTime = Date.now();
  
  // TEST MODE: Allow test harness to get JSON responses instead of streaming
  const { searchParams } = new URL(request.url);
  const testMode = searchParams.get('test_mode') === 'json';
  if (testMode) {
  }

  // DIAGNOSTIC MODE: Enable debug output for places-diagnostics testing
  const isPlacesDiagnosticsMode = request.headers.get('X-Test-Mode') === 'places-diagnostics';
  const testSecret = request.headers.get('X-Test-Secret');
  const expectedSecret = process.env.ASSISTANT_TEST_SECRET || process.env.TEST_SECRET;
  const isDiagnosticsAuthenticated = isPlacesDiagnosticsMode && testSecret && expectedSecret && testSecret === expectedSecret;
  
  if (isDiagnosticsAuthenticated) {
  }

  // Diagnostic tracking object - populated throughout the request
  interface ChatDiagnostics {
    intent_detected: boolean;
    intent_type?: string;
    resolved_identifiers: {
      unit_uid?: string | null;
      scheme_id?: string | null;
      development_id?: string | null;
      tenant_id?: string | null;
    };
    scheme_location: {
      present: boolean;
      lat?: number | null;
      lng?: number | null;
      address?: string | null;
      source?: string;
    };
    places_call: {
      attempted: boolean;
      category?: string;
    };
    places_result: {
      google_status?: string;
      http_status?: number;
      result_count?: number;
      error_message?: string;
    };
    fallback_reason?: string;
    cache_hit?: boolean;
    scheme_resolution_path?: string;
  }

  const chatDiagnostics: ChatDiagnostics = {
    intent_detected: false,
    resolved_identifiers: {},
    scheme_location: { present: false },
    places_call: { attempted: false },
    places_result: {},
  };

  try {
    const contentLength = request.headers.get('content-length');
    const maxPayloadBytes = 100 * 1024; // 100KB max payload
    if (contentLength && parseInt(contentLength, 10) > maxPayloadBytes) {
      return NextResponse.json(
        createStructuredError('Payload too large', requestId, { error_code: 'PAYLOAD_TOO_LARGE' }),
        { status: 413, headers: getResponseHeaders(requestId) }
      );
    }

    const body = await request.json();
    const { message, unitUid: clientUnitUid, userId, hasBeenWelcomed, intentMetadata, lastIntentKey, language, developmentId: clientDevelopmentId } = body;
    const selectedLanguage = language || 'en';
    
    interface IntentMetadataPayload {
      source: 'suggested_pill';
      intent_key: string;
      template_id: string;
      pill_id: string;
    }
    const parsedIntentMetadata: IntentMetadataPayload | null = intentMetadata || null;
    const activeIntentKey: string | null = parsedIntentMetadata?.intent_key || lastIntentKey || null;

    if (!message) {
      return NextResponse.json(
        createStructuredError('message is required', requestId, { error_code: 'MISSING_MESSAGE' }),
        { status: 400, headers: getResponseHeaders(requestId) }
      );
    }

    if (typeof message !== 'string') {
      return NextResponse.json(
        createStructuredError('message must be a string', requestId, { error_code: 'INVALID_MESSAGE' }),
        { status: 400, headers: getResponseHeaders(requestId) }
      );
    }

    const maxMessageLength = 8000; // ~2000 tokens max
    if (message.length > maxMessageLength) {
      return NextResponse.json(
        createStructuredError('Message too long', requestId, { error_code: 'MESSAGE_TOO_LONG' }),
        { status: 400, headers: getResponseHeaders(requestId) }
      );
    }

    // ASSISTANT OS: Intent classification and tiered emergency handling
    let intentClassification: IntentClassification | null = null;
    let answerStrategy: AnswerStrategy | null = null;
    
    if (isAssistantOSEnabled()) {
      intentClassification = classifyIntent(message);
      answerStrategy = getAnswerStrategy(intentClassification);
      
      // Handle tiered emergency responses
      if (intentClassification.emergencyTier === 1) {
        const tier1Response = getTier1Response();
        
        await persistMessageSafely({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: clientUnitUid || userId || null,
          unit_uid: clientUnitUid || null,
          user_message: message,
          ai_message: tier1Response,
          question_topic: 'emergency_tier1',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            assistantOS: true,
            intent: intentClassification.intent,
            emergencyTier: 1,
            answerMode: answerStrategy.mode,
            userId: userId || null,
          },
          request_id: requestId,
        });
        
        return NextResponse.json({
          success: true,
          answer: tier1Response,
          source: 'emergency_tier1',
          safetyIntercept: true,
          isNoInfo: false,
          metadata: {
            intent: intentClassification.intent,
            emergencyTier: 1,
            answerMode: answerStrategy.mode,
          },
        });
      }
      
      if (intentClassification.emergencyTier === 2) {
        const tier2Response = getTier2Response();
        
        await persistMessageSafely({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: clientUnitUid || userId || null,
          unit_uid: clientUnitUid || null,
          user_message: message,
          ai_message: tier2Response,
          question_topic: 'emergency_tier2',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            assistantOS: true,
            intent: intentClassification.intent,
            emergencyTier: 2,
            answerMode: answerStrategy.mode,
            userId: userId || null,
          },
          request_id: requestId,
        });
        
        return NextResponse.json({
          success: true,
          answer: tier2Response,
          source: 'emergency_tier2',
          safetyIntercept: true,
          isNoInfo: false,
          metadata: {
            intent: intentClassification.intent,
            emergencyTier: 2,
            answerMode: answerStrategy.mode,
          },
        });
      }
      
      if (intentClassification.emergencyTier === 3) {
        const tier3Response = getTier3Response();
        
        await persistMessageSafely({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: clientUnitUid || userId || null,
          unit_uid: clientUnitUid || null,
          user_message: message,
          ai_message: tier3Response,
          question_topic: 'maintenance_tier3',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            assistantOS: true,
            intent: intentClassification.intent,
            emergencyTier: 3,
            answerMode: answerStrategy.mode,
            userId: userId || null,
          },
          request_id: requestId,
        });
        
        return NextResponse.json({
          success: true,
          answer: tier3Response,
          source: 'maintenance_tier3',
          safetyIntercept: false,
          isNoInfo: false,
          metadata: {
            intent: intentClassification.intent,
            emergencyTier: 3,
            answerMode: answerStrategy.mode,
          },
        });
      }
      
      // NOTE: Location/Amenities intent is handled after user context is established (see below)
      
      // Handle humor requests after safety checks - adds personality to the assistant
      // TONE GUARDRAILS: Block humor if safety mode is active
      const humorBlocked = isToneGuardrailsEnabled() && shouldBlockHumor({
        intentType: intentClassification?.intent || 'general',
        safetyIntercept: false,
        confidence: 'high',
        sourceType: 'general',
      });
      
      if (isHumorRequest(message) && !humorBlocked) {
        const jokeResponse = formatJokeResponse();
        
        await persistMessageSafely({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: clientUnitUid || userId || null,
          unit_uid: clientUnitUid || null,
          user_message: message,
          ai_message: jokeResponse,
          question_topic: 'humor',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            assistantOS: true,
            intent: 'humor',
            userId: userId || null,
          },
          request_id: requestId,
        });
        
        return NextResponse.json({
          success: true,
          answer: jokeResponse,
          source: 'humor',
          isNoInfo: false,
          metadata: {
            intent: 'humor',
          },
        });
      }
    }
    
    // SAFETY-CRITICAL PRE-FILTER (fallback for non-OS mode or missed patterns)
    const safetyCheck = isSafetyCriticalQuery(message);
    if (safetyCheck.isCritical && (!isAssistantOSEnabled() || !intentClassification?.emergencyTier)) {
      
      await persistMessageSafely({
        tenant_id: DEFAULT_TENANT_ID,
        development_id: DEFAULT_DEVELOPMENT_ID,
        user_id: clientUnitUid || userId || null,
        unit_uid: clientUnitUid || null,
        user_message: message,
        ai_message: SAFETY_INTERCEPT_RESPONSE,
        question_topic: 'safety_intercept',
        source: 'purchaser_portal',
        latency_ms: Date.now() - startTime,
        metadata: {
          safetyIntercept: true,
          matchedKeyword: safetyCheck.matchedKeyword,
          userId: userId || null,
        },
        request_id: requestId,
      });
      
      return NextResponse.json({
        success: true,
        answer: SAFETY_INTERCEPT_RESPONSE,
        source: 'safety_intercept',
        safetyIntercept: true,
        isNoInfo: false,
      });
    }

    const token = request.headers.get('x-qr-token');
    let validatedUnitUid: string | null = null;

    if (token) {
      try {
        const payload = await validateQRToken(token);
        if (payload && payload.supabaseUnitId) {
          validatedUnitUid = payload.supabaseUnitId;
        } else {
        }
      } catch (_tokenError) {
          // error handled silently
      }
    } else {
    }

    // Establish effective unit UID with fallback chain for drawing lookup
    const effectiveUnitUid = validatedUnitUid || clientUnitUid || null;

    // GDPR PROTECTION: Fetch user's unit details and check for questions about other units
    // This also gets house_type_code for RAG filtering (CRITICAL for correct document retrieval)
    const userUnitDetails = effectiveUnitUid 
      ? await getUserUnitDetails(effectiveUnitUid)
      : { address: null, houseType: null, unitInfo: null };
    
    const userHouseTypeCode = userUnitDetails.unitInfo?.house_type_code || null;
    const userTenantId = userUnitDetails.unitInfo?.tenant_id || DEFAULT_TENANT_ID;
    const userDevelopmentId = userUnitDetails.unitInfo?.development_id || DEFAULT_DEVELOPMENT_ID;
    // SEV-1 FIX: Capture actual Supabase unit ID for message linkage
    // This is the true unit.id from Supabase, not the effectiveUnitUid which may be a different format
    const actualUnitId = userUnitDetails.unitInfo?.id || null;
    // For vector search (document_sections.project_id), use the developmentId from the request body first.
    // This ensures the filter matches the actual project_id stored in document_sections rows.
    // supabase_project_id is a legacy field that may hold a stale value — only use as last resort.
    const userSupabaseProjectId = clientDevelopmentId  // Request body developmentId — matches document_sections.project_id
      || userDevelopmentId    // Unit's development_id from DB lookup
      || userUnitDetails.unitInfo?.supabase_project_id  // Legacy fallback
      || (userTenantId === DEFAULT_TENANT_ID ? PROJECT_ID : null)
      || null;

    // Determine scheme resolution path for diagnostics
    let schemeResolutionPath = 'unknown';
    if (clientDevelopmentId) {
      schemeResolutionPath = 'client_development_id';
    } else if (userDevelopmentId && userDevelopmentId !== DEFAULT_DEVELOPMENT_ID) {
      schemeResolutionPath = 'unit_development_id';
    } else if (userUnitDetails.unitInfo?.supabase_project_id) {
      schemeResolutionPath = 'unit_info.supabase_project_id';
    } else if (userTenantId === DEFAULT_TENANT_ID) {
      schemeResolutionPath = 'default_project_id_fallback';
    } else {
      schemeResolutionPath = 'failed';
    }

    // Populate diagnostics with resolved identifiers
    chatDiagnostics.resolved_identifiers = {
      unit_uid: effectiveUnitUid,
      scheme_id: userSupabaseProjectId,
      development_id: userDevelopmentId,
      tenant_id: userTenantId,
    };
    chatDiagnostics.scheme_resolution_path = schemeResolutionPath;
    
    // Capability context will be built after sessionMemory and developmentName are defined
    let capabilityContext: CapabilityContext | null = null;
    
    // Escalation guidance for when documents are not found
    let escalationGuidance: EscalationOutput | null = null;
    
    if (!userSupabaseProjectId) {
      chatDiagnostics.fallback_reason = 'missing_scheme_id';
      
      const errorResponse: Record<string, unknown> = {
        success: true,
        answer: "I'm unable to access your development's knowledge base at the moment. Please try again later or contact your management company for assistance.",
        source: 'tenant_config_error',
      };
      
      if (isDiagnosticsAuthenticated) {
        errorResponse.debug = chatDiagnostics;
      }
      
      return NextResponse.json(errorResponse, { headers: { 'x-request-id': requestId } });
    }
    
    const gdprCheck = detectOtherUnitQuestion(message, userUnitDetails.address);
    
    // HIGH-RISK TOPIC DETECTION: Check if this is a safety/emergency question
    const highRiskCheck = detectHighRiskTopic(message);
    if (highRiskCheck.isHighRisk) {
    }
    
    if (gdprCheck.isAboutOtherUnit) {
      
      const gdprResponse = userUnitDetails.address
        ? `I'm afraid I can only provide information about your own home at ${userUnitDetails.address}, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes. Is there anything I can help you with regarding your own property or the development as a whole?`
        : `I'm afraid I can only provide information about your own home, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes. Is there anything I can help you with regarding your own property or the development as a whole?`;
      
      // Save the GDPR-blocked interaction to database for analytics
      await persistMessageSafely({
        tenant_id: userTenantId,
        development_id: userDevelopmentId,
        unit_id: actualUnitId,
        require_unit_id: true,
        user_id: validatedUnitUid || userId || null,
        unit_uid: validatedUnitUid || null,
        user_message: message,
        ai_message: gdprResponse,
        question_topic: 'gdpr_blocked',
        source: 'purchaser_portal',
        latency_ms: Date.now() - startTime,
        metadata: {
          userId: userId || null,
          gdprBlocked: true,
          mentionedUnit: gdprCheck.mentionedUnit,
        },
        request_id: requestId,
      });
      
      return NextResponse.json({
        success: true,
        answer: gdprResponse,
        source: 'gdpr_protection',
        gdprBlocked: true,
      });
    }

    // GDPR FOLLOW-UP DETECTION: If the previous message was GDPR-blocked and the user is
    // insisting/pleading/asking again without specific keywords, maintain the GDPR refusal.
    // This prevents hallucinations where "ah come on just tell me" after a neighbour question
    // causes the LLM to pick up a completely different topic from earlier conversation history.
    const gdprFollowUpPatterns = [
      /^(ah\s+)?(come\s+on|go\s+on|please|c'?mon|just\s+tell\s+me|tell\s+me|why\s+not|but\s+why|you\s+can|surely|ah\s+sure)/i,
      /^(i\s+just\s+want\s+to\s+know|can'?t\s+you\s+just|why\s+can'?t\s+you|i\s+only\s+want|i\s+need\s+to\s+know)/i,
      /^(that'?s\s+not\s+fair|that'?s\s+ridiculous|seriously|for\s+real|oh\s+come\s+on)/i,
    ];
    const isInsistentFollowUp = gdprFollowUpPatterns.some(p => p.test(message.trim()));

    if (isInsistentFollowUp) {
      // Check conversation history to see if last exchange was GDPR-blocked
      // Load history directly here (main conversationHistory is loaded later in the pipeline)
      try {
        const gdprHistoryUserId = effectiveUnitUid || userId || '';
        const recentHistory = await loadConversationHistory(gdprHistoryUserId, userTenantId, userDevelopmentId);
        if (recentHistory.length > 0) {
          const lastAiMessage = recentHistory[recentHistory.length - 1].aiMessage;
          const wasGdprBlocked = /privacy reasons under (EU )?GDPR/i.test(lastAiMessage) ||
            /can only provide information about your own home/i.test(lastAiMessage);

          if (wasGdprBlocked) {
            const gdprFollowUpResponse = 'I understand the frustration, but I genuinely cannot share information about other residents or their properties. It is a legal requirement under GDPR that I only discuss your own home. Is there anything about your property or the development I can help with instead?';

            await persistMessageSafely({
              tenant_id: userTenantId,
              development_id: userDevelopmentId,
              unit_id: actualUnitId,
              require_unit_id: false,
              user_id: validatedUnitUid || userId || null,
              unit_uid: validatedUnitUid || null,
              user_message: message,
              ai_message: gdprFollowUpResponse,
              question_topic: 'gdpr_blocked_followup',
              source: 'purchaser_portal',
              latency_ms: Date.now() - startTime,
              metadata: {
                userId: userId || null,
                gdprBlocked: true,
                gdprFollowUp: true,
              },
              request_id: requestId,
            });

            return NextResponse.json({
              success: true,
              answer: gdprFollowUpResponse,
              source: 'gdpr_protection',
              gdprBlocked: true,
            });
          }
        }
      } catch (_gdprHistoryErr) {
        // If history lookup fails, fall through to normal pipeline — never crash
      }
    }

    // LOCAL HISTORY + SEAI GRANTS + UTILITY WIZARD: Removed — all questions now go through RAG pipeline.
    // These interceptors returned hardcoded static responses, bypassing document_sections vector search.
    const developmentName = userUnitDetails?.unitInfo?.development_name || null;
    // SESSION MEMORY: Extract and update session-scoped context
    let sessionMemory: SessionMemory | null = null;
    let sessionMemoryDebug: MemoryDebugInfo | null = null;
    let sessionMemoryUpdatedKeys: string[] = [];
    
    if (isSessionMemoryEnabled() && effectiveUnitUid && userSupabaseProjectId) {
      // Get existing memory first
      sessionMemory = getSessionMemory(userTenantId, userSupabaseProjectId, effectiveUnitUid);
      
      // Extract memory from current message and update
      const memoryResult = updateSessionFromMessage(
        userTenantId,
        userSupabaseProjectId,
        effectiveUnitUid,
        message,
        intentClassification?.intent || null,
        null // followup_topic will be set after response generation
      );
      
      sessionMemory = memoryResult.memory;
      sessionMemoryUpdatedKeys = memoryResult.updatedKeys;
      
      if (sessionMemoryUpdatedKeys.length > 0) {
      }
      
      if (hasRelevantMemory(sessionMemory)) {
      }
      
      // Generate debug info for observability
      sessionMemoryDebug = getMemoryDebugInfo(sessionMemory, sessionMemoryUpdatedKeys);
    }

    // AFFIRMATIVE INTENT: Handle "yes", "sure", "please" by routing to the previous follow-up suggestion
    const isAffirmativeMessage = intentClassification?.intent === 'affirmative' || isYesIntent(message);
    if (isAssistantOSEnabled() && isAffirmativeMessage) {
      
      // Load conversation history to find the previous assistant message
      const history = await loadConversationHistory(
        validatedUnitUid || clientUnitUid || userId || '',
        userTenantId,
        userDevelopmentId
      );
      
      if (history.length > 0) {
        const lastAssistantMessage = history[history.length - 1].aiMessage;
        
        // Import follow-up routing utilities
        const { getFollowUpCategories } = await import('@/lib/places/poi');
        
        // Extract the follow-up topic from the previous message
        const followUpPatterns = [
          /Would you like (?:to know about|information on|more about) (.+?)\??$/i,
          /Would you like (.+?) (?:as well|too)\??$/i,
          /Let me know if you need (.+?) information\.?$/i,
        ];
        
        let extractedTopic: string | null = null;
        for (const pattern of followUpPatterns) {
          const match = lastAssistantMessage.match(pattern);
          if (match && match[1]) {
            extractedTopic = match[1].replace(/nearby |local |in the area|as well|too/gi, '').trim();
            break;
          }
        }
        
        if (extractedTopic) {
          
          // Map the extracted topic to POI categories
          const categories = getFollowUpCategories(extractedTopic);
          
          if (categories && categories.length > 0) {
            
            // Override the intent to location_amenities and set the category
            // Inject the extracted topic into the message for proper POI handling
            const syntheticQuery = extractedTopic;
            const poiCategoryResult = detectPOICategoryExpanded(syntheticQuery);
            
            if (poiCategoryResult.category) {
              // Re-classify as location_amenities with the extracted category
              intentClassification = {
                intent: 'location_amenities',
                confidence: 0.9,
                keywords: ['affirmative-routed', extractedTopic],
                emergencyTier: null,
              };
              
              // Update message to be the synthetic query for downstream processing
              // This will be handled by the location_amenities block below
            }
          }
        }
        
        if (intentClassification?.intent === 'affirmative') {
          // Couldn't extract a follow-up topic - provide helpful response
          
          const helpfulResponse = 'I want to help, but I am not sure what you would like more information about. Could you tell me specifically what you would like to know?';
          
          await persistMessageSafely({
            tenant_id: userTenantId,
            development_id: userDevelopmentId,
            unit_id: actualUnitId,
        require_unit_id: true,
            user_id: validatedUnitUid || userId || null,
            unit_uid: validatedUnitUid || null,
            user_message: message,
            ai_message: helpfulResponse,
            question_topic: 'affirmative_no_context',
            source: 'purchaser_portal',
            latency_ms: Date.now() - startTime,
            metadata: { assistantOS: true, intent: 'affirmative' },
            request_id: requestId,
          });
          
          return NextResponse.json({
            success: true,
            answer: helpfulResponse,
            source: 'affirmative_clarification',
          });
        }
      } else {
        // No conversation history - ask for clarification
        const clarificationResponse = 'I want to help, but I am not sure what you would like more information about. Could you tell me what you are looking for?';
        
        await persistMessageSafely({
          tenant_id: userTenantId,
          development_id: userDevelopmentId,
          unit_id: actualUnitId,
        require_unit_id: true,
          user_id: validatedUnitUid || userId || null,
          unit_uid: validatedUnitUid || null,
          user_message: message,
          ai_message: clarificationResponse,
          question_topic: 'affirmative_no_history',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: { assistantOS: true, intent: 'affirmative' },
          request_id: requestId,
        });
        
        return NextResponse.json({
          success: true,
          answer: clarificationResponse,
          source: 'affirmative_clarification',
        });
      }
    }

    // WEATHER GATE: Met Éireann, free, no key required
    if (isAssistantOSEnabled()) {
      const weatherKeywords = /\b(weather|forecast|raining|sunny|temperature|how cold|how warm|wind|windy|storm|snow|will it rain|what('s| is) the weather|met (é|e)ireann|climate today|outside today)\b/i;
      if (weatherKeywords.test(message)) {
        try {
          const weatherResult = await getWeather(userSupabaseProjectId);
          const weatherResponse = formatWeatherResponse(weatherResult);

          return NextResponse.json({
            success: true,
            answer: weatherResponse,
            source: 'met_eireann',
            isNoInfo: false,
            metadata: { intent: 'weather' },
            suggested_questions: generateFollowUpQuestions('weather', message),
            weather_card: {
              city: weatherResult.city.charAt(0).toUpperCase() + weatherResult.city.slice(1),
              temp: weatherResult.current?.temperature || null,
              conditions: weatherResult.current?.weatherDescription || null,
              wind_speed: weatherResult.current?.windSpeed || null,
              wind_dir: weatherResult.current?.cardinalWindDirection || null,
              humidity: weatherResult.current?.humidity || null,
              forecast_today: weatherResult.forecast?.today?.slice(0, 120) || null,
            },
          });
        } catch (weatherErr) {
          // Fall through to normal handling
        }
      }
    }

    // ACTIVE TRAVEL GATE: walking/cycling time queries — use Directions API
    // IMPORTANT: Only fires for GENERAL travel queries (to town, city centre, etc.)
    // If the question mentions a specific amenity (pharmacy, supermarket, etc.), let the
    // POI handler answer instead — it already returns walk times via Distance Matrix.
    // Bug fix: "How far of a walk is it to the closest pharmacy?" was routing here
    // instead of the pharmacy POI lookup, giving city-centre times instead of pharmacy distance.
    if (isAssistantOSEnabled() && intentClassification?.intent === 'location_amenities') {
      const activeTravelKeywords = /\b(walk|walking|walkable|on foot|cycle|cycling|cyclable|bike|biking|cycle to work|walk to (town|city|centre|center)|how far (is|to)|cycling distance|cycle time|walk time)\b/i;
      // If a specific amenity is detected, skip active travel and let POI handler answer with real distances
      const mentionsSpecificAmenity = detectPOICategoryExpanded(message).category !== null;
      if (activeTravelKeywords.test(message) && !mentionsSpecificAmenity) {
        try {
          const activeTravelResult = await getActiveTravelTimes(userSupabaseProjectId);
          const activeTravelResponse = formatActiveTravelResponse(activeTravelResult);

          return NextResponse.json({
            success: true,
            answer: activeTravelResponse,
            source: 'active_travel',
            isNoInfo: false,
            metadata: { intent: 'active_travel' },
            suggested_questions: generateFollowUpQuestions('transport', message),
          });
        } catch (activeTravelErr) {
          // Fall through to normal amenity handling
        }
      }
    }

    // AMENITY ANSWERING GATE: STRICT - location_amenities MUST use Google Places, no RAG fallback
    // This prevents hallucinated venue names, opening hours, and travel times
    if (isAssistantOSEnabled() && intentClassification?.intent === 'location_amenities') {
      const poiCategoryResult = detectPOICategoryExpanded(message);
      const poiCategory = poiCategoryResult.category;
      const expandedIntent = poiCategoryResult.expandedIntent;
      const expandedCategories = poiCategoryResult.categories;
      const dynamicKeyword = poiCategoryResult.dynamicKeyword;
      const schemeAddress = userUnitDetails?.address || 'your development';
      const developmentName = userUnitDetails?.unitInfo?.development_name || null;
      
      // Populate intent diagnostics
      chatDiagnostics.intent_detected = true;
      chatDiagnostics.intent_type = 'location_amenities';
      chatDiagnostics.scheme_location.address = schemeAddress;
      
      // Import gap logger for observability
      const { logAnswerGap } = await import('@/lib/assistant/gap-logger');
      
      // DYNAMIC KEYWORD SEARCH: If no predefined category but we extracted a keyword, use text search
      if (!poiCategory && dynamicKeyword) {
        chatDiagnostics.places_call.category = `dynamic:${dynamicKeyword}`;
        
        try {
          const { searchNearbyByKeyword, formatDynamicPOIResponse } = await import('@/lib/places/poi');
          const dynamicResults = await searchNearbyByKeyword(userSupabaseProjectId, dynamicKeyword);
          
          const dynamicResponse = formatDynamicPOIResponse(
            dynamicResults,
            dynamicKeyword,
            developmentName || undefined,
            undefined // Let the function use random seed
          );
          
          await persistMessageSafely({
            tenant_id: userTenantId,
            development_id: userDevelopmentId,
            unit_id: actualUnitId,
        require_unit_id: true,
            user_id: clientUnitUid || userId || null,
            unit_uid: clientUnitUid || null,
            user_message: message,
            ai_message: dynamicResponse,
            question_topic: 'poi_dynamic_search',
            source: 'purchaser_portal',
            latency_ms: Date.now() - startTime,
            metadata: {
              assistantOS: true,
              intent: intentClassification.intent,
              dynamicKeyword,
              resultsCount: dynamicResults.results.length,
              userId: userId || null,
            },
            request_id: requestId,
          });
          
          const dynamicResponseObj: Record<string, unknown> = {
            success: true,
            answer: dynamicResponse,
            source: 'google_places_dynamic',
            safetyIntercept: false,
            isNoInfo: dynamicResults.results.length === 0,
            metadata: {
              intent: intentClassification.intent,
              answerMode: 'dynamic_poi',
              sourceHint: 'Based on Google Places',
              dynamicKeyword,
            },
          };
          
          if (isDiagnosticsAuthenticated) {
            dynamicResponseObj.debug = chatDiagnostics;
          }
          
          return NextResponse.json(dynamicResponseObj);
        } catch (err) {
          // Fall through to generic fallback
        }
      }
      
      if (!poiCategory) {
        // Could not determine POI category - provide generic response, DO NOT fall through to RAG
        chatDiagnostics.fallback_reason = 'unknown_poi_category';
        
        const fallbackResponse = `I'd be happy to help with that – are you looking for shops, restaurants, schools, or something else nearby? Just let me know and I'll point you in the right direction.`;
        
        await logAnswerGap({
          scheme_id: userSupabaseProjectId,
          unit_id: clientUnitUid || null,
          user_question: message,
          intent_type: 'location_amenities',
          attempted_sources: ['google_places'],
          final_source: 'fallback',
          gap_reason: 'amenities_fallback_used',
        });
        
        await persistMessageSafely({
          tenant_id: userTenantId,
          development_id: userDevelopmentId,
          unit_id: actualUnitId,
        require_unit_id: true,
          user_id: clientUnitUid || userId || null,
          unit_uid: clientUnitUid || null,
          user_message: message,
          ai_message: fallbackResponse,
          question_topic: 'poi_category_unknown',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            assistantOS: true,
            intent: intentClassification.intent,
            amenityGateFallback: true,
            userId: userId || null,
          },
          request_id: requestId,
        });
        
        const fallbackResponseObj: Record<string, unknown> = {
          success: true,
          answer: fallbackResponse,
          source: 'amenities_fallback',
          safetyIntercept: false,
          isNoInfo: true,
          metadata: {
            intent: intentClassification.intent,
            answerMode: answerStrategy?.mode,
            sourceHint: 'General guidance',
          },
        };
        
        if (isDiagnosticsAuthenticated) {
          fallbackResponseObj.debug = chatDiagnostics;
        }
        
        return NextResponse.json(fallbackResponseObj);
      }
      
      chatDiagnostics.places_call.category = poiCategory;
      
      // Check for test mode header for diagnostics
      const isTestMode = request.headers.get('X-Test-Mode') === 'places-diagnostics';
      
      try {
        chatDiagnostics.places_call.attempted = true;
        
        // Handle expanded intents (e.g., "schools" = primary + secondary, "local_amenities" = multiple categories)
        let poiData: Awaited<ReturnType<typeof getNearbyPOIs>>;
        let effectiveCategory = poiCategory;
        let groupedSchoolsData: GroupedSchoolsData | null = null;
        let groupedAmenitiesData: GroupedAmenitiesData | null = null;
        
        if (expandedIntent && expandedCategories && expandedCategories.length > 1) {
          
          // Fetch all categories and merge results
          const allResults: Awaited<ReturnType<typeof getNearbyPOIs>>[] = [];
          const categoryResults: Record<string, POIResult[]> = {};
          
          for (const cat of expandedCategories) {
            const catData = await getNearbyPOIs(userSupabaseProjectId, cat);
            allResults.push(catData);
            categoryResults[cat] = catData.results;
          }
          
          // For schools, create grouped data structure
          if (expandedIntent === 'schools') {
            groupedSchoolsData = {
              primary: categoryResults['primary_school'] || [],
              secondary: categoryResults['secondary_school'] || [],
              fetchedAt: allResults[0]?.fetched_at || new Date(),
              diagnostics: allResults[0]?.diagnostics,
            };
          }
          
          // For local_amenities, create grouped data structure with dedupe and fill
          if (expandedIntent === 'local_amenities') {
            const isTestMode = request.headers.get('X-Test-Mode') === 'places-diagnostics';
            const dedupedData = dedupeAndFillAmenities(categoryResults, isTestMode);
            
            groupedAmenitiesData = {
              supermarket: dedupedData.supermarket,
              pharmacy: dedupedData.pharmacy,
              gp: dedupedData.gp,
              transport: dedupedData.transport,
              cafe: dedupedData.cafe,
              fetchedAt: allResults[0]?.fetched_at || new Date(),
              diagnostics: allResults[0]?.diagnostics,
              schemeName: developmentName || undefined,
            };
          }
          
          // Merge and dedupe results by place_id (for non-local_amenities expanded intents)
          const seenPlaceIds = new Set<string>();
          const mergedResults: typeof allResults[0]['results'] = [];
          
          for (const catData of allResults) {
            for (const result of catData.results) {
              if (!seenPlaceIds.has(result.place_id)) {
                seenPlaceIds.add(result.place_id);
                mergedResults.push(result);
              }
            }
          }
          
          // Sort by distance
          mergedResults.sort((a, b) => a.distance_km - b.distance_km);
          
          // Use the first category's diagnostics as base
          poiData = {
            ...allResults[0],
            results: mergedResults,
          };
          
          // Use a display category name for expanded intents
          if (expandedIntent === 'schools') {
            effectiveCategory = 'primary_school'; // Will show "schools" in response
          }
        } else {
          poiData = await getNearbyPOIs(userSupabaseProjectId, poiCategory);
        }
        
        // Use diagnostics to determine appropriate gap reason
        const diagnostics = poiData.diagnostics;
        const gapReason = diagnostics?.failure_reason || (poiData.results.length === 0 ? 'no_places_results' : undefined);
        
        // Populate chatDiagnostics with places result info from POI engine
        if (diagnostics) {
          chatDiagnostics.scheme_location = {
            present: diagnostics.scheme_location_present,
            lat: diagnostics.scheme_lat,
            lng: diagnostics.scheme_lng,
            address: diagnostics.scheme_address || schemeAddress,
            source: diagnostics.scheme_location_source || undefined,
          };
          chatDiagnostics.places_result = {
            google_status: diagnostics.places_api_error_code,
            http_status: diagnostics.places_http_status,
            result_count: poiData.results.length,
            error_message: diagnostics.places_error_message,
          };
          chatDiagnostics.cache_hit = diagnostics.cache_hit;
          chatDiagnostics.fallback_reason = diagnostics.failure_reason;
          // Update scheme_resolution_path to reflect actual source
          if (diagnostics.scheme_location_source) {
            chatDiagnostics.scheme_resolution_path = diagnostics.scheme_location_source;
          } else if (isLocationMissingReason(diagnostics.failure_reason)) {
            chatDiagnostics.scheme_resolution_path = 'missing_scheme_location';
          }
        }
        
        // If stale cache was used, log it
        if (poiData.is_stale && diagnostics?.failure_reason) {
          await logAnswerGap({
            scheme_id: userSupabaseProjectId,
            unit_id: clientUnitUid || null,
            user_question: message,
            intent_type: 'location_amenities',
            attempted_sources: ['google_places'],
            final_source: 'stale_cache',
            gap_reason: 'google_places_stale_cache_used',
          });
        }
        
        // STRICT GATE: If no results, DO NOT fall through to RAG - provide controlled fallback
        if (poiData.results.length === 0) {
          
          const isMissingLocation = isLocationMissingReason(diagnostics?.failure_reason);
          const categoryName = poiCategory.replace(/_/g, ' ');
          
          let noResultsResponse: string;
          if (isMissingLocation) {
            noResultsResponse = `The development location hasn't been set up yet, so I'm not able to search for nearby places at the moment. Your developer should be able to sort that out.`;
          } else {
            noResultsResponse = `I wasn't able to pull up ${categoryName} results right now. Google Maps will give you the most accurate and up-to-date results for what's nearby.`;
          }
          
          await logAnswerGap({
            scheme_id: userSupabaseProjectId,
            unit_id: clientUnitUid || null,
            user_question: message,
            intent_type: 'location_amenities',
            attempted_sources: ['google_places'],
            final_source: 'fallback',
            gap_reason: gapReason || 'no_places_results',
          });
          
          await persistMessageSafely({
            tenant_id: userTenantId,
            development_id: userDevelopmentId,
            unit_id: actualUnitId,
        require_unit_id: true,
            user_id: clientUnitUid || userId || null,
            unit_uid: clientUnitUid || null,
            user_message: message,
            ai_message: noResultsResponse,
            question_topic: `poi_${poiCategory}_no_results`,
            source: 'purchaser_portal',
            latency_ms: Date.now() - startTime,
            metadata: {
              assistantOS: true,
              intent: intentClassification.intent,
              poiCategory,
              amenityGateNoResults: true,
              schemeId: userSupabaseProjectId,
              userId: userId || null,
            },
            request_id: requestId,
          });
          
          const noResultsResponseObj: Record<string, unknown> = {
            success: true,
            answer: noResultsResponse,
            source: 'amenities_fallback',
            safetyIntercept: false,
            isNoInfo: true,
            metadata: {
              intent: intentClassification.intent,
              poiCategory,
              answerMode: answerStrategy?.mode,
              sourceHint: 'General guidance',
            },
          };
          
          // Include unified diagnostics in test mode only (authenticated)
          if (isDiagnosticsAuthenticated) {
            noResultsResponseObj.debug = chatDiagnostics;
          }
          
          // Log fallback reason to server logs
          
          return NextResponse.json(noResultsResponseObj);
        }
        
        // Use effectiveCategory for display (handles expanded intents)
        const displayCategory = effectiveCategory || poiCategory;
        const formatOptions: FormatPOIOptions = {
          developmentName: developmentName || undefined,
          category: displayCategory,
          limit: 5,
        };
        
        // For expanded intents, use custom response formatting
        let poiResponse: string;
        let transitResult: Awaited<ReturnType<typeof getTransitRoutes>> | null = null;
        if (expandedIntent === 'schools' && groupedSchoolsData) {
          poiResponse = formatGroupedSchoolsResponse(groupedSchoolsData, developmentName || undefined);
        } else if (expandedIntent === 'local_amenities' && groupedAmenitiesData) {
          poiResponse = formatLocalAmenitiesResponse(groupedAmenitiesData, developmentName || undefined);
        } else if (expandedIntent === 'shops') {
          poiResponse = formatShopsResponse(poiData, developmentName || undefined);
        } else if (poiCategory === 'bus_stop' || poiCategory === 'train_station') {
          // Transport queries: enrich with TFI route data via Google Directions API (transit mode)
          try {
            transitResult = await getTransitRoutes(userSupabaseProjectId);
            poiResponse = formatTransitRoutesResponse(transitResult, poiData.results);
          } catch (transitErr) {
            poiResponse = formatPOIResponse(poiData, formatOptions);
          }
        } else {
          poiResponse = formatPOIResponse(poiData, formatOptions);
        }
        
        // OPTIONAL DOCUMENT AUGMENTATION: Enhance Places response with scheme documentation
        // Documents can ONLY augment, never replace place names, distances, or rankings
        const { getAmenityDocContext, formatAugmentedResponse, buildMultiSourceHint } = await import('@/lib/assistant/amenity-augmenter');
        
        let docAugmentUsed = false;
        try {
          const docContext = await getAmenityDocContext(userDevelopmentId, poiCategory, message);
          if (docContext.found) {
            poiResponse = formatAugmentedResponse(poiResponse, docContext);
            docAugmentUsed = true;
            
            // Log augmentation for observability
            await logAnswerGap({
              scheme_id: userSupabaseProjectId,
              unit_id: clientUnitUid || null,
              user_question: message,
              intent_type: 'location_amenities',
              attempted_sources: ['google_places', 'smart_archive'],
              final_source: 'google_places',
              gap_reason: 'amenities_doc_augment_used',
            });
          }
        } catch (_augmentError) {
            // error handled silently
        }
        
        // Build multi-source hint
        const sourceHint = buildMultiSourceHint(true, poiData.fetched_at, docAugmentUsed);

        // Build static map URL if we have development location and POI coords
        let mapUrl: string | null = null;
        try {
          // Prefer server key, fallback to browser key (Static Maps API may only be on one)
          const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          const schemeLoc = chatDiagnostics.scheme_location;
          if (googleApiKey && schemeLoc?.lat && schemeLoc?.lng && poiData.results.some(p => p.lat && p.lng)) {
            mapUrl = buildStaticMapUrl(schemeLoc.lat, schemeLoc.lng, poiData.results, googleApiKey);
          }
        } catch (_mapErr) {
            // error handled silently
        }

        // Generate response first, then persist safely (never fail the response)
        // Build transit card for bus/train queries with route data
        const transitCard = (poiCategory === 'bus_stop' || poiCategory === 'train_station') && transitResult && transitResult.routes.length > 0 ? {
          routes: transitResult.routes.map(r => ({
            short_name: r.line_short_name,
            long_name: r.line_name,
            vehicle_type: r.vehicle_type,
            headsign: r.headsign,
            journey_min: r.journey_min,
          })),
          destination: transitResult.destination,
        } : null;

        const successResponseObj: Record<string, unknown> = {
          success: true,
          answer: poiResponse,
          source: docAugmentUsed ? 'google_places_with_docs' : 'google_places',
          safetyIntercept: false,
          isNoInfo: false,
          suggested_questions: generateFollowUpQuestions('location_amenities', message),
          map_url: mapUrl,
          transit_card: transitCard,
          metadata: {
            intent: intentClassification.intent,
            poiCategory,
            fromCache: poiData.from_cache,
            isStale: poiData.is_stale || false,
            fetchedAt: poiData.fetched_at.toISOString(),
            docAugmented: docAugmentUsed,
            answerMode: answerStrategy?.mode,
            sourceHint,
          },
        };
        
        // Persist message safely - don't let DB errors fail the response
        const persistResult = await persistMessageSafely({
          tenant_id: userTenantId,
          development_id: userDevelopmentId,
          unit_id: actualUnitId,
        require_unit_id: true,
          user_id: userId,
          unit_uid: clientUnitUid,
          user_message: message,
          ai_message: poiResponse,
          question_topic: `poi_${poiCategory}`,
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            assistantOS: true,
            intent: intentClassification.intent,
            poiCategory,
            fromCache: poiData.from_cache,
            resultCount: poiData.results.length,
            docAugmented: docAugmentUsed,
            schemeId: userSupabaseProjectId,
          },
          request_id: requestId,
        });
        
        if (!persistResult.success) {
          successResponseObj.metadata.messagePersistFailed = true;
        }
        
        // Include unified diagnostics in test mode only (authenticated)
        if (isDiagnosticsAuthenticated) {
          successResponseObj.debug = chatDiagnostics;
        }
        
        return NextResponse.json(successResponseObj);
      } catch (poiError) {
        // STRICT GATE: On Places API error, DO NOT fall through to RAG - provide controlled fallback
        
        const errorResponse = `I couldn't retrieve nearby amenities right now. Please try again later, or check Google Maps for ${schemeAddress}.`;
        
        // Update diagnostics for error case
        chatDiagnostics.fallback_reason = 'api_error';
        chatDiagnostics.places_result.error_message = poiError instanceof Error ? poiError.message : 'Unknown error';
        
        // Log gap (non-critical, wrapped in try/catch)
        try {
          await logAnswerGap({
            scheme_id: userSupabaseProjectId,
            unit_id: clientUnitUid || null,
            user_question: message,
            intent_type: 'location_amenities',
            attempted_sources: ['google_places'],
            final_source: 'fallback',
            gap_reason: 'google_places_failed',
          });
        } catch (_gapLogError) {
            // error handled silently
        }
        
        // Persist message safely - don't let DB errors fail the response
        const persistResult = await persistMessageSafely({
          tenant_id: userTenantId,
          development_id: userDevelopmentId,
          unit_id: actualUnitId,
        require_unit_id: true,
          user_id: userId,
          unit_uid: clientUnitUid,
          user_message: message,
          ai_message: errorResponse,
          question_topic: `poi_${poiCategory}_error`,
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            assistantOS: true,
            intent: intentClassification.intent,
            poiCategory,
            amenityGateError: true,
            errorMessage: poiError instanceof Error ? poiError.message : 'Unknown error',
            schemeId: userSupabaseProjectId,
          },
          request_id: requestId,
        });
        
        const errorResponseObj: Record<string, unknown> = {
          success: true,
          answer: errorResponse,
          source: 'amenities_fallback',
          safetyIntercept: false,
          isNoInfo: true,
          metadata: {
            intent: intentClassification.intent,
            poiCategory,
            answerMode: answerStrategy?.mode,
            sourceHint: 'General guidance',
          },
        };
        
        if (!persistResult.success) {
          errorResponseObj.metadata.messagePersistFailed = true;
        }
        
        // Include unified diagnostics in test mode only (authenticated)
        if (isDiagnosticsAuthenticated) {
          errorResponseObj.debug = chatDiagnostics;
        }
        
        // Log fallback reason to server logs
        
        return NextResponse.json(errorResponseObj);
      }
    }

    // STEP 0: Load conversation history for context-aware responses
    // Use effective unit UID (validated token OR client-provided) as user identifier for session isolation
    // This ensures conversation continuity even when QR token validation fails but client unit UID exists
    const conversationUserId = effectiveUnitUid || userId || '';
    const conversationHistory = await loadConversationHistory(conversationUserId, userTenantId, userDevelopmentId);
    
    // Check if this is a follow-up question that needs context expansion
    const needsContext = isFollowUpQuestion(message) && conversationHistory.length > 0;
    let searchQuery = needsContext
      ? expandQueryWithContext(message, conversationHistory)
      : message;

    if (needsContext) {
    }

    // MULTILINGUAL SUPPORT: Translate query to English for RAG retrieval
    // Documents are embedded in English, so querying in English gives best semantic match
    // The AI response will still be in the user's selected language (handled separately)
    if (selectedLanguage !== 'en') {
      searchQuery = await translateQueryToEnglish(searchQuery, selectedLanguage);
    }

    // STEP 1: Generate embeddings — original query + expanded alternatives for better retrieval
    const queryVariants = await expandQueryForRetrieval(searchQuery);

    // Embed all variants and average the vectors — improves recall on technical documents
    const embeddingResponses = await Promise.all(
      queryVariants.map(q =>
        getOpenAIClient().embeddings.create({
          model: 'text-embedding-3-small',
          input: q,
          dimensions: 1536,
        })
      )
    );

    // Average the embeddings across all variants
    const allEmbeddings = embeddingResponses.map(r => r.data[0].embedding);
    const queryEmbedding = allEmbeddings[0].map((_: number, i: number) => {
      const sum = allEmbeddings.reduce((acc: number, emb: number[]) => acc + emb[i], 0);
      return sum / allEmbeddings.length;
    });

    // STEP 2: Semantic search using cosine similarity on ALL chunks
    // First, get list of superseded document IDs to filter out from RAG
    // Use resolved userTenantId to filter by correct tenant
    let supersededDocIds = new Set<string>();
    try {
      const { rows: superseded } = await db.execute(sql`
        SELECT id FROM documents 
        WHERE tenant_id = ${userTenantId}::uuid 
        AND is_superseded = true
      `);
      supersededDocIds = new Set((superseded as { id: string }[]).map(r => r.id));
      if (supersededDocIds.size > 0) {
      }
    } catch (_e) {
        // error handled silently
    }
    
    // SERVER-SIDE pgvector SIMILARITY SEARCH via match_document_sections()
    // Uses HNSW index — returns top-50 pre-ranked chunks, no in-memory cosine needed.
    // Replaces the previous fetch-all-then-cosine-in-JS approach (was loading ~1000+ rows
    // of 1536-dim embeddings into memory on every request).
    
    type DocumentChunk = { id: string; content: string; metadata: Record<string, unknown>; embedding?: unknown; similarity?: number; _pgvector_similarity?: number | null; [key: string]: unknown };
    let allChunks: DocumentChunk[] | null = null;
    let supabaseError: string | null = null;

    const chunkLoadStart = Date.now();
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .rpc('match_document_sections', {
          query_embedding: queryEmbedding,
          match_project_id: userSupabaseProjectId,
          match_count: 50,
        });

      if (fetchError) {
        // Fallback: fetch without vector ranking if RPC fails (e.g. function not yet deployed)
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('document_sections')
          .select('id, content, metadata, embedding')
          .eq('project_id', userSupabaseProjectId)
          .limit(200);
        if (fallbackErr) {
          supabaseError = fallbackErr.message;
        } else {
          allChunks = fallbackData;
        }
      } else {
        // RPC returns: { id, content, metadata, similarity }
        // Map similarity onto _pgvector_similarity so the scoring section can use it
        allChunks = (data || []).map((d: Record<string, unknown>) => ({
          ...d,
          id: d.id as string,
          content: d.content as string,
          metadata: (d.metadata || {}) as Record<string, unknown>,
          _pgvector_similarity: typeof d.similarity === 'number' ? d.similarity : null,
        }));
      }
    } catch (supabaseErr) {
      supabaseError = supabaseErr instanceof Error ? supabaseErr.message : 'Connection failed';
    }

    if (supabaseError || !allChunks) {
      return NextResponse.json({
        success: false,
        error: 'Unable to access knowledge base',
        details: supabaseError || 'No documents found',
        answer: "I'm sorry, I'm currently unable to access the property information system. Please try again in a moment, or contact your development's support team if the issue persists.",
      }, { status: 503 });
    }

    // SUPPLEMENTAL KEYWORD SEARCH: Fetch extra chunks via text matching on content
    // This catches documents that are keyword-relevant but semantically distant from the query embedding
    // (e.g. "what brand of solar panels" vs a document titled "solar_panel_specifications.pdf")
    try {
      const significantKeywords = message.toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
        .filter((w: string) => !['what', 'which', 'where', 'when', 'does', 'have', 'that', 'this', 'with', 'from', 'about', 'they', 'their', 'there', 'your', 'will', 'been', 'would', 'could', 'should', 'into', 'more', 'some', 'than', 'them', 'very', 'just', 'also', 'over'].includes(w));

      if (significantKeywords.length > 0) {
        const existingIds = new Set(allChunks.map(c => c.id));
        const supabase = getSupabaseClient();

        // Text search on content field using Postgres ILIKE matching
        const { data: keywordChunks } = await supabase
          .from('document_sections')
          .select('id, content, metadata')
          .eq('project_id', userSupabaseProjectId)
          .or(significantKeywords.slice(0, 3).map(kw => `content.ilike.%${kw}%`).join(','))
          .limit(20);

        if (keywordChunks && keywordChunks.length > 0) {
          for (const kc of keywordChunks) {
            if (!existingIds.has(kc.id)) {
              allChunks.push({
                ...kc,
                _pgvector_similarity: null, // No vector score — scored by keyword boost only
              } as DocumentChunk);
              existingIds.add(kc.id);
            }
          }
        }
      }
    } catch (_keywordErr) {
      // Keyword search failed — continue with vector results only
    }

    // SUPPLEMENTAL FLOOR PLAN SEARCH: When user asks about floor plans and we know their house type,
    // explicitly fetch architectural chunks for their house type so they always surface regardless of
    // vector similarity (coded drawing filenames like "2R1-MHL-BS08-ZZ-DR-A-0040" are semantically
    // distant from "can you give me the floor plans").
    const isFloorPlanMessage = /\b(floor\s*plan|drawing|layout|elevation|section)\b/i.test(message);
    if (isFloorPlanMessage && userHouseTypeCode && userSupabaseProjectId) {
      try {
        const existingIds = new Set(allChunks.map(c => c.id));
        const supabase = getSupabaseClient();
        const { data: drawingChunks } = await supabase
          .from('document_sections')
          .select('id, content, metadata')
          .eq('project_id', userSupabaseProjectId)
          .filter('metadata->>house_type_code', 'eq', userHouseTypeCode)
          .limit(20);
        if (drawingChunks) {
          for (const dc of drawingChunks) {
            if (!existingIds.has(dc.id)) {
              allChunks.push({
                ...dc,
                _pgvector_similarity: null,
              } as DocumentChunk);
              existingIds.add(dc.id);
            }
          }
        }
      } catch (_fpSearchErr) {
        // Floor plan search failed — continue with existing chunks
      }
    }

    // Calculate similarity scores for ALL chunks
    let chunks: DocumentChunk[] = [];
    if (allChunks && allChunks.length > 0) {
      
      // DRAWING INTENT DETECTION: Only include floor plans if question is about drawings/dimensions
      const isDrawingRelatedQuestion = /\b(floor\s*plan|drawing|layout|dimensions?|room\s*size|measurements?|square\s*(feet|metres?|meters?|ft|m2)|how\s+(big|large)\s+(is|are)|what\s+size|internal\s+layout|elevation|section)\b/i.test(message);
      
      // Patterns that identify floor plan/drawing documents (coded filenames like 2R1-MHL-BS04-ZZ-DR-A-0040)
      const FLOOR_PLAN_PATTERNS = [
        /\d+[a-z]*-[a-z]+-[a-z]+\d+-[a-z]+-[a-z]+-[a-z]+-\d+/i, // Coded drawing numbers like 2R1-MHL-BS04-ZZ-DR-A-0040
        /house\s*type\s*[a-z]*\d+/i, // "House Type BS04"
        /ground\s*floor|first\s*floor|second\s*floor/i,
        /floor\s*plan/i,
        /elevation/i,
        /-DR-A-/i, // Common architectural drawing code
        /rev\.?[a-z]\d+/i, // Revision codes like Rev.C06
      ];
      
      // Filter out superseded documents before scoring
      // Also filter out technical/engineering documents that are NOT homeowner-facing
      // EXCEPTION: Solar/renewable energy docs are tagged "electrical" but ARE homeowner-relevant
      const isSolarOrRenewableQuestion = /\b(solar|photovoltaic|pv\s*panel|renewable|panel[s]?\s*(on|fitted|installed|brand|type|spec|model)|heat\s*pump|inverter|energy\s*rating|ber|nzeb)\b/i.test(message);

      const EXCLUDED_DISCIPLINES = isSolarOrRenewableQuestion
        ? ['structural', 'engineering', 'mechanical', 'plumbing', 'mep', 'hvac', 'fire_strategy', 'fire_engineering', 'gas', 'construction', 'as_built', 'detailed_design', 'technical', 'contractor']
        : ['structural', 'engineering', 'electrical', 'mechanical', 'plumbing', 'mep', 'hvac', 'fire_strategy', 'fire_engineering', 'gas', 'construction', 'as_built', 'detailed_design', 'technical', 'contractor'];

      const EXCLUDED_FILENAME_PATTERNS = [
        /structural/i, /engineer/i, /\bSE\b/, /\bMEP\b/, /electrical.*schematic/i,
        /gas.*schematic/i, /fire.*strategy/i, /construction.*issue/i, /as.?built/i,
        /detailed.*design/i, /contractor.*manual/i, /internal.*spec/i,
        /load.*calc/i, /beam.*calc/i, /foundation/i, /reinforcement/i
      ];
      
      const activeChunks = allChunks.filter(chunk => {
        const docId = chunk.metadata?.document_id;
        const discipline = (chunk.metadata?.discipline || '').toLowerCase();
        const fileName = (chunk.metadata?.file_name || chunk.metadata?.source || '');
        const fileNameLower = fileName.toLowerCase();
        const chunkHouseTypeCode = getChunkHouseTypeCode(chunk);
        
        // Exclude superseded documents
        if (docId && supersededDocIds.has(docId)) {
          return false;
        }
        
        // CRITICAL HOUSE TYPE FILTERING: When user has a known house type, 
        // filter house-type-specific documents to ONLY their house type.
        // This prevents returning floor plans/specs for BS02 when user has BD01.
        // Compare case-insensitively for robustness
        if (userHouseTypeCode && chunkHouseTypeCode) {
          const userHouseTypeLower = userHouseTypeCode.toLowerCase();
          const chunkHouseTypeLower = chunkHouseTypeCode.toLowerCase();
          // This document is house-type-specific - only include if it matches user's house type
          if (chunkHouseTypeLower !== userHouseTypeLower) {
            return false;
          }
        }
        
        // CRITICAL: If question is NOT about drawings, exclude floor plan documents
        if (!isDrawingRelatedQuestion) {
          // Check if this is a floor plan/drawing document
          if (FLOOR_PLAN_PATTERNS.some(pattern => pattern.test(fileName))) {
            return false;
          }
          // Also exclude by discipline if marked as floorplans/elevations/drawings
          if (['floorplans', 'floorplan', 'elevations', 'elevation', 'drawings', 'architectural'].includes(discipline)) {
            return false;
          }
        }
        
        // Exclude technical/engineering disciplines
        if (EXCLUDED_DISCIPLINES.some(d => discipline.includes(d))) {
          return false;
        }
        
        // Exclude files with technical/engineering patterns in filename
        if (EXCLUDED_FILENAME_PATTERNS.some(pattern => pattern.test(fileNameLower))) {
          return false;
        }
        
        // Default to include if is_homeowner_facing is true or not set (assume safe)
        // Only exclude if explicitly marked as not homeowner-facing
        if (chunk.metadata?.is_homeowner_facing === false) {
          return false;
        }
        
        return true;
      });
      
      if (activeChunks.length < allChunks.length) {
        if (userHouseTypeCode) {
        }
      }
      
      const scoredChunks = activeChunks.map(chunk => {
        // Use pre-computed pgvector similarity if available (server-side HNSW search),
        // otherwise fall back to in-memory cosine (used when RPC fallback path triggered)
        let similarity = 0;
        if (typeof chunk._pgvector_similarity === 'number') {
          similarity = chunk._pgvector_similarity;
        } else {
          const parsedEmbedding = parseEmbedding(chunk.embedding);
          if (parsedEmbedding) {
            similarity = cosineSimilarity(queryEmbedding, parsedEmbedding);
          }
        }
        
        // Boost score for keyword matches (hybrid search)
        const keywords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const contentLower = (chunk.content || '').toLowerCase();
        const metadataStr = JSON.stringify(chunk.metadata || {}).toLowerCase();
        const fileNameLower = ((chunk.metadata?.file_name || chunk.metadata?.source || '') as string).toLowerCase();

        let keywordBoost = 0;
        keywords.forEach((kw: string) => {
          if (contentLower.includes(kw)) keywordBoost += 0.05;
          if (metadataStr.includes(kw)) keywordBoost += 0.03;
          // Extra boost when keyword appears in the document filename (e.g. "solar" in "solar_panel_specs.pdf")
          if (fileNameLower.includes(kw)) keywordBoost += 0.08;
        });
        
        // Combined score: semantic similarity + keyword boost
        const finalScore = similarity + keywordBoost;
        
        return {
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          similarity,
          keywordBoost,
          score: finalScore,
        };
      });
      
      // Sort by score and take top chunks
      scoredChunks.sort((a, b) => b.score - a.score);
      
      // MINIMUM RELEVANCE THRESHOLD - if top chunks aren't relevant enough, treat as "no info"
      // Uses combined score (similarity + keyword boost) so keyword-matched docs aren't unfairly filtered
      const MIN_RELEVANCE_SCORE = 0.20;
      const topChunkScore = scoredChunks[0]?.score || 0;

      if (topChunkScore < MIN_RELEVANCE_SCORE) {
        // Don't add any chunks - this will trigger the "no documents" prompt
      } else {
        // Take top chunks that fit within context limit
        let totalChars = 0;
        for (const chunk of scoredChunks) {
          if (chunks.length >= MAX_CHUNKS) break;
          if (totalChars + chunk.content.length > MAX_CONTEXT_CHARS) break;
          chunks.push(chunk);
          totalChars += chunk.content.length;
        }
      }
      
      if (chunks.length > 0) {
      }
    }

    // ROOM DIMENSIONS: Fetch room dimensions for this specific unit
    let roomDimensions: { room_name: string; width_m: number | null; length_m: number | null; area_sqm: number | null; floor: string | null }[] | null = null;
    if (actualUnitId) {
      try {
        const rdSupabase = getSupabaseClient();
        const { data: rdData } = await rdSupabase
          .from('unit_room_dimensions')
          .select('room_name, width_m, length_m, area_sqm, floor')
          .eq('unit_id', actualUnitId)
          .order('floor', { ascending: true });
        roomDimensions = rdData;
      } catch (_rdErr) {
        // Room dimensions query failed — continue without
      }
    }

    // STEP 3: Build System Message with relevant context only
    let systemMessage: string;
    
    // Check if this is the first message ever for this user (for greeting logic)
    // Priority: 1) Client-provided hasBeenWelcomed flag (persisted in localStorage)
    // 2) Fall back to server conversation history for legacy clients
    const isFirstMessage = typeof hasBeenWelcomed === 'boolean'
      ? !hasBeenWelcomed
      : conversationHistory.length === 0;
    
    // CAPABILITY EVALUATOR: Determine support level based on RAG quality
    // This prevents the AI from offering follow-up help it cannot deliver
    type SupportLevel = 'full' | 'partial' | 'none';
    
    const evaluateSupportLevel = (): SupportLevel => {
      if (!chunks || chunks.length === 0) return 'none';
      
      const topSimilarity = chunks[0]?.similarity || 0;
      const avgSimilarity = chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length;
      
      // Full support: high confidence in top chunk AND good average
      if (topSimilarity >= 0.45 && avgSimilarity >= 0.35) return 'full';
      
      // Partial support: some relevant info but not comprehensive
      if (topSimilarity >= 0.30 && chunks.length >= 2) return 'partial';
      
      // Low support: marginal relevance
      return 'none';
    };
    
    const supportLevel = evaluateSupportLevel();
    
    // Build capability-aware follow-up instruction
    const getFollowUpInstruction = (): string => {
      switch (supportLevel) {
        case 'full':
          return `FOLLOW-UP OFFERS:
- You may offer to provide more specific details if you have comprehensive information in the reference data
- Only offer follow-up help for topics where you have actual data to share
- Example: "If you'd like more details about [specific topic from reference data], just ask!"`;
        
        case 'partial':
          return `FOLLOW-UP OFFERS (LIMITED):
- You have limited information on this topic
- Do NOT offer to provide "specific recommendations", "detailed directions", or "particular suggestions" - you don't have that level of detail
- If you cannot fully answer the question, acknowledge the limitation honestly
- Offer to help with something else instead of redirecting to the developer`;

        case 'none':
        default:
          return `FOLLOW-UP OFFERS (RESTRICTED):
- You do NOT have sufficient information to offer any follow-up assistance on this topic
- NEVER say phrases like "feel free to ask", "if you need specific recommendations", "just ask for more details"
- State honestly that you don't have detailed information, then offer to help with a different question
- Do NOT suggest contacting the developer unless it's for something only they would know (warranty claims, construction defects)`;
      }
    };

    if (chunks && chunks.length > 0) {
      const referenceData = chunks
        .map((chunk) => {
          const fileName = chunk.metadata?.file_name || chunk.metadata?.source || 'Document';
          const section = chunk.metadata?.section ? `, Section: ${chunk.metadata.section}` : '';
          const page = chunk.metadata?.page_number ? `, p.${chunk.metadata.page_number}` : '';
          const compressed = compressChunk(chunk.content, message);
          return `[Source: ${fileName}${section}${page}]\n${compressed}`;
        })
        .join('\n---\n');

      const sources = Array.from(new Set(chunks.map((c) => (c.metadata?.file_name || c.metadata?.source || 'Document') as string)));

      systemMessage = `You are a home assistant for ${developmentName || 'this development'}. You help homeowners with questions about their specific home, their development and community, and their local area.

${isFirstMessage ? `This is the homeowner's first message — give a one-sentence warm welcome, then answer directly.` : `Follow-up message — no greeting, answer directly.`}
${userHouseTypeCode ? `
HOME TYPE: Your home is house type ${userHouseTypeCode}. Your floor plans and architectural drawings are available in the Documents tab. When asked about floor plans, tell the homeowner their ${userHouseTypeCode} drawings are in the Docs tab and describe what's there: ground and first floor plans, elevations, sections, and house pad.
` : ''}
${roomDimensions && roomDimensions.length > 0 ? `ROOM DIMENSIONS FOR THIS HOME:
Ground Floor:
${roomDimensions.filter(r => r.floor === 'Ground').map(r => `- ${r.room_name}: ${r.width_m}m × ${r.length_m}m (${r.area_sqm}m²)`).join('\n')}

First Floor:
${roomDimensions.filter(r => r.floor === 'First').map(r => `- ${r.room_name}: ${r.width_m}m × ${r.length_m}m (${r.area_sqm}m²)`).join('\n')}

When asked about room sizes, give the exact dimensions above — width × length and area. Always end by telling the homeowner their floor plans are in the Documents tab.
` : ''}${hasRelevantMemory(sessionMemory) ? `${getMemoryContext(sessionMemory)}\n` : ''}TONE & FORMAT:
- Warm and helpful, like a knowledgeable neighbour — match the homeowner's energy
- Lead with the answer, supporting context after
- Irish/UK English: colour, centre, realise; natural phrases (no bother, grand, cheers) are fine when they fit
- Never use filler phrases like "feel free to ask", "don't hesitate to reach out", or "I hope this helps"
- Plain text only — no markdown (#, *, _, >, backticks). Section labels use a colon: "Heating:" not "**Heating:**"
- Lists use dashes or numbers. Natural paragraph breaks for structure.
- If asked about room sizes, give the actual dimensions (width x length) from the reference data, not just area.

${getFollowUpInstruction()}

REFERENCE DATA (from: ${sources.join(', ')}):
--- BEGIN REFERENCE DATA ---
${referenceData}
--- END REFERENCE DATA ---

ACCURACY:
- Property-specific facts (specs, contacts, dates, warranties, building details): ONLY from reference data — never invent
- General knowledge (how appliances work, home maintenance, local context): use your intelligence freely
- Never fabricate property-specific data. If you don't have it, say so and offer what you can.

DEVELOPER REFERRALS — MINIMISE:
- Only refer to the developer for warranty claims, construction defects, or legal disputes that only they can resolve
- For everything else: answer directly or acknowledge the gap — do not redirect unnecessarily

NEARBY AMENITIES — STRICT:
- NEVER invent or name specific businesses, shops, cafes, pubs, restaurants, or venues
- NEVER give walking/driving times or distances unless explicitly in the reference data
- If asked about local places: offer to help if they ask specifically, or suggest Google Maps for current info

HIGH-RISK TOPICS — REDIRECT TO PROFESSIONALS:
- Medical/health: "I can't give medical advice — contact your GP or call 999/112 for emergencies."
- Legal matters: "I can't give legal advice — consult a solicitor for property legal questions."
- Structural safety (cracks, subsidence, load-bearing walls): redirect to structural engineer or developer warranty provider
- Fire safety (alarms, escape routes, fire doors): redirect to fire service or management company
- Electrical faults: redirect to a registered electrician
- Gas issues/smells: Gas Networks Ireland emergency line 0800 111 999 — evacuate immediately for suspected leaks
- Any emergency: "Call 999 or 112 immediately."

SAFETY RULES — MANDATORY:
- Never advise on structural, electrical, plumbing, gas, heating repair, or fire-safety modifications
- Never confirm any wall, installation, or appliance is safe to alter, remove, or modify
- Never diagnose defects, hazards, or structural risks
- For safety-critical questions: acknowledge the concern → state you cannot give safety advice → direct to the right professional → reference the homeowner manual if relevant
- If immediate danger (gas smell, burning, electrical arcing, major leak, structural movement): instruct to call 999 or 112 immediately — do not give further guidance

ROOM DIMENSIONS:
- When room dimensions appear in the REFERENCE DATA above (width and length), quote them as width x length (e.g. "4.27m x 3.66m") and include the floor area if available
- Always add a disclaimer that these are approximate and the official floor plan has exact measurements
- If no dimensions are in the reference data, say: "I've popped the floor plan below — that'll have the accurate dimensions."

FLOOR PLANS RULE: Whenever a homeowner asks about room sizes, dimensions, layouts, or floor plans, ALWAYS end your response by telling them: "Your ${userHouseTypeCode || 'home'} floor plans are available in the Documents tab — ground floor plan, first floor plan, elevations, sections, and house pad drawing are all there for reference."

This applies whether or not you have the exact dimensions. Always point them to the floor plans.

GDPR — PRIVACY (LEGAL REQUIREMENT):
- Only discuss the logged-in homeowner's own unit${userUnitDetails.address ? ` (${userUnitDetails.address})` : ''}
- Never provide information about other residents, units, or neighbours
- If asked about another unit: "I can only provide information about your own home or general development information. For privacy reasons under GDPR, I can't share details about other residents."
- Allowed: development/estate info, community amenities, shared facilities, local area
- Not allowed: any other specific unit, other residents' details, neighbours' properties`;

      // TIER 2 HOME KNOWLEDGE: Inject general factual guidance when relevant to the question
      const homeKnowledgeEntries = getRelevantHomeKnowledge(message);
      if (homeKnowledgeEntries.length > 0) {
        const homeKnowledgeContext = formatHomeKnowledgeContext(homeKnowledgeEntries);
        systemMessage = systemMessage + `\n\n${homeKnowledgeContext}`;
      }

      // WARRANTY AWARENESS: Inject specific warranty guidance based on message content
      const warrantyType = detectWarrantyType(message);
      if (warrantyType !== 'unknown') {
        const warrantyGuidance = getWarrantyGuidance(warrantyType);
        systemMessage = systemMessage + `\n\nWARRANTY GUIDANCE (use this when discussing relevant issues):\n${warrantyGuidance}`;
      }

      // PROACTIVE DOCUMENT SURFACING: If appliance keywords present in question, instruct model to offer relevant docs
      const applianceKeywords = ['dishwasher','washing machine','washer','dryer','tumble dryer','fridge','freezer','refrigerator','microwave','oven','hob','cooker','extractor','air conditioning','radiator','heat pump','boiler','shower','bath','ventilation','solar','ev charger','car charger','daikin','ohme','bosch','siemens','zanussi','neff','samsung','lg','whirlpool'];
      const hasApplianceQuestion = applianceKeywords.some(kw => message.toLowerCase().includes(kw));
      if (hasApplianceQuestion) {
        systemMessage = systemMessage + `\n\nPROACTIVE DOCUMENT OFFER: If the reference documents above include a manual, warranty document, or spec sheet relevant to what the user is asking about, proactively mention it at the end of your answer with a natural offer like "I also have the [document name] available if you'd like to see it."`;
      }

      // SUGGESTED PILLS V2: Apply intent playbook enhancement when intent metadata is present
      if (activeIntentKey) {
        const intentPlaybook = getIntentPlaybook(activeIntentKey);
        if (intentPlaybook) {
          const intentPrompt = buildIntentSystemPrompt(intentPlaybook);
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${intentPrompt}\n\n---\n\n${systemMessage}`;
        } else {
          // Always apply Global Safety Contract even without a specific playbook
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${systemMessage}`;
        }
      }

      // Update capability context now that we know documents are available
      capabilityContext = buildCapabilityContext({
        hasDocuments: true,
        hasSchemeLocation: !!userUnitDetails?.address,
        placesApiWorking: !!process.env.GOOGLE_PLACES_API_KEY,
        hasSessionMemory: isSessionMemoryEnabled() && hasRelevantMemory(sessionMemory),
        hasUnitInfo: !!userUnitDetails?.unitInfo,
        hasFloorPlans: chunks.some((c) => (c.metadata?.file_name as string | undefined)?.toLowerCase().includes('floor')),
        hasDrawings: chunks.some((c) => (c.metadata?.file_name as string | undefined)?.toLowerCase().includes('drawing')),
        isLongviewOrRathard: checkIsLongviewOrRathard(developmentName),
      });
    } else {
      // No documents - build capability context with limited capabilities
      capabilityContext = buildCapabilityContext({
        hasDocuments: false,
        hasSchemeLocation: !!userUnitDetails?.address,
        placesApiWorking: !!process.env.GOOGLE_PLACES_API_KEY,
        hasSessionMemory: isSessionMemoryEnabled() && hasRelevantMemory(sessionMemory),
        hasUnitInfo: !!userUnitDetails?.unitInfo,
        hasFloorPlans: false,
        hasDrawings: false,
        isLongviewOrRathard: checkIsLongviewOrRathard(developmentName),
      });
      systemMessage = `You are a home assistant for ${developmentName || 'this development'}. You help homeowners with questions about their specific home, their development and community, and their local area.

${hasRelevantMemory(sessionMemory) ? `${getMemoryContext(sessionMemory)}\n` : ''}NO REFERENCE DATA: You don't have documents that answer this specific question. Acknowledge this honestly and conversationally — don't be robotic. Never invent, guess, or infer any property-specific facts.

NEARBY AMENITIES — STRICT:
- NEVER invent or name specific businesses, shops, cafes, pubs, restaurants, or venues
- NEVER give walking/driving times or distances
- If asked about local places: offer to help if they ask specifically, or suggest Google Maps for current info

FOLLOW-UP OFFERS: Do not invite further questions on topics you can't answer. Acknowledge the gap and redirect clearly.

HIGH-RISK TOPICS — REDIRECT TO PROFESSIONALS:
- Medical/health: redirect to GP or 999/112 for emergencies
- Legal matters: redirect to a solicitor
- Structural safety (cracks, subsidence, load-bearing): redirect to structural engineer or developer warranty provider
- Fire safety: redirect to fire service or management company
- Electrical faults: redirect to a registered electrician
- Gas issues/smells: Gas Networks Ireland 0800 111 999 — evacuate immediately for suspected leaks
- Any emergency: "Call 999 or 112 immediately."

SAFETY RULES — MANDATORY:
- Never advise on structural, electrical, plumbing, gas, heating repair, or fire-safety modifications
- Never confirm any wall, installation, or appliance is safe to alter, remove, or modify
- Never diagnose defects, hazards, or structural risks
- For safety-critical questions: acknowledge → state you cannot give safety advice → direct to the right professional
- If immediate danger (gas smell, burning, electrical arcing, major leak, structural movement): instruct to call 999 or 112 immediately

GDPR — PRIVACY (LEGAL REQUIREMENT):
- Only discuss the logged-in homeowner's own unit${userUnitDetails.address ? ` (${userUnitDetails.address})` : ''}
- Never provide information about other residents, units, or neighbours
- If asked about another unit: "I can only provide information about your own home or general development information. For privacy reasons under GDPR, I can't share details about other residents."
- Allowed: development/estate info, community amenities, shared facilities, local area
- Not allowed: any other specific unit, other residents' details, neighbours' properties

FLOOR PLANS RULE: Whenever a homeowner asks about room sizes, dimensions, layouts, or floor plans, ALWAYS end your response by telling them: "Your ${userHouseTypeCode || 'home'} floor plans are available in the Documents tab — ground floor plan, first floor plan, elevations, sections, and house pad drawing are all there for reference."

This applies whether or not you have the exact dimensions. Always point them to the floor plans.

SMART FALLBACK GUIDANCE — When You Don't Have Documents:
Be specific and helpful — don't just say "I don't have that." Based on what the homeowner is asking:
- Snagging / defects / repairs: "You can report this to your developer via the Documents tab or by contacting them directly. If your home is within the first 12 months, most defects are covered."
- Warranties (structural, latent defects): "Structural warranty runs 10 years from build completion (Homebond or Premier Guarantee). Check your warranty certificate in the Documents tab."
- Appliances / heating / MVHR: "Your appliance manuals should be in the Documents tab. For servicing, contact the manufacturer or your property management company."
- Management company / OMC / service charge: "Contact your Owners' Management Company (OMC). Details should be in your handover pack in the Documents tab."
- Planning / building regulations: "Refer to your local council or contact your developer. Your architect's cert in the Documents tab may be relevant."
- If you genuinely cannot help: Acknowledge the gap clearly, name the specific person/resource they should contact, and offer to help with what you do know about their home.
Do NOT say "I'll check for more information" — you cannot. Do NOT say "I'm not sure" as a complete answer — provide a specific redirect.`;

      // TIER 2 HOME KNOWLEDGE: Inject even when no scheme docs — this is general guidance
      const homeKnowledgeEntriesNoDocs = getRelevantHomeKnowledge(message);
      if (homeKnowledgeEntriesNoDocs.length > 0) {
        const homeKnowledgeContextNoDocs = formatHomeKnowledgeContext(homeKnowledgeEntriesNoDocs);
        systemMessage = systemMessage + `\n\n${homeKnowledgeContextNoDocs}`;
      }

      // WARRANTY AWARENESS: Inject warranty guidance even when no docs are available
      const warrantyTypeNoDocs = detectWarrantyType(message);
      if (warrantyTypeNoDocs !== 'unknown') {
        const warrantyGuidanceNoDocs = getWarrantyGuidance(warrantyTypeNoDocs);
        systemMessage = systemMessage + `\n\nWARRANTY GUIDANCE (use this when discussing relevant issues):\n${warrantyGuidanceNoDocs}`;
      }

      // SUGGESTED PILLS V2: Apply intent playbook enhancement when intent metadata is present (no documents case)
      if (activeIntentKey) {
        const intentPlaybook = getIntentPlaybook(activeIntentKey);
        if (intentPlaybook) {
          const intentPrompt = buildIntentSystemPrompt(intentPlaybook);
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${intentPrompt}\n\n---\n\n${systemMessage}`;
        } else {
          // Always apply Global Safety Contract even without a specific playbook
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${systemMessage}`;
        }
      }

      // ESCALATION GUIDANCE: When no documents, provide helpful escalation path
      if (isEscalationEnabled()) {
        const detectedIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
        escalationGuidance = routeEscalation({
          intent: detectedIntent,
          confidence: 'none',
          gapReason: 'no_documents_found',
          sessionContext: {
            block: sessionMemory?.block ?? undefined,
            unitNumber: userUnitDetails?.address?.split(',')[0] || undefined,
            developmentName: developmentName ?? undefined,
            // Use session-tracked appliance and issue for more specific escalation
            issueType: sessionMemory?.issue ?? (sessionMemory?.appliance ? `${sessionMemory.appliance} issue` : undefined),
          },
        });
      }
      
      // Log unanswered event with full question context for training insights
      logAnalyticsEvent({
        tenantId: userTenantId,
        developmentId: userDevelopmentId,
        houseTypeCode: userHouseTypeCode || undefined,
        eventType: 'unanswered',
        eventCategory: 'no_relevant_docs',
        eventData: { 
          reason: 'low_similarity_or_no_chunks',
          question_preview: message.substring(0, 200),
          conversationDepth: conversationHistory.length + 1,
          escalationTarget: escalationGuidance?.escalationTarget,
        },
        sessionId: validatedUnitUid || conversationUserId,
        unitId: effectiveUnitUid,
      }).catch(() => {});

      // Log to answer_gap_log so developer dashboard can surface missing documents
      import('@/lib/assistant/gap-logger').then(({ logAnswerGap }) => {
        if (userDevelopmentId) {
          logAnswerGap({
            scheme_id: userDevelopmentId,
            unit_id: actualUnitId || null,
            user_question: message.substring(0, 500),
            intent_type: activeIntentKey || 'unknown',
            attempted_sources: ['rag_search', 'pgvector'],
            final_source: 'no_documents_found',
            gap_reason: 'no_documents_found',
            details: {
              top_similarity: allChunks?.[0]?._pgvector_similarity ?? 0,
              query_variants: queryVariants.length,
              threshold: 0.40,
            },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    // STEP 4: Extract question topic and find drawing BEFORE streaming (parallel with RAG)
    const questionTopicPromise = extractQuestionTopic(message);
    
    let drawing: ResolvedDrawing | null = null;
    let drawingExplanation = '';
    
    // Check if this is an ambiguous dimension question that needs clarification
    const isAmbiguousSizeQuestion = /\b(how\s*(big|large)|size|dimensions?)\s*(of|is)?\s*(my|the)?\s*(house|home|property)\b/i.test(message) ||
      /\b(what|how)\s+.*(house|home|property)\s*.*(size|dimensions?|big|large)\b/i.test(message);
    
    // Start drawing lookup in parallel with topic extraction
    const drawingPromise = effectiveUnitUid
      ? findDrawingForQuestion(
          effectiveUnitUid,
          await questionTopicPromise,
          userSupabaseProjectId || undefined,
          userHouseTypeCode || undefined
        ).catch(() => ({ found: false, drawing: null, explanation: '' }))
      : Promise.resolve({ found: false, drawing: null, explanation: '' });

    const [questionTopic, drawingResult] = await Promise.all([
      questionTopicPromise,
      drawingPromise
    ]);

    // Calculate response quality metrics for analytics
    const topSimilarity = chunks[0]?.similarity || 0;
    const avgSimilarity = chunks.length > 0 
      ? chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length 
      : 0;
    const confidenceLevel = topSimilarity >= 0.5 ? 'high' : topSimilarity >= 0.35 ? 'medium' : 'low';
    const needsTraining = topSimilarity < 0.35 || chunks.length < 3;
    
    // Determine if we have verified development attribution (from unit lookup, not fallback)
    const hasVerifiedDevelopment = !!userUnitDetails.unitInfo?.development_id;
    
    // Extract source document IDs and names for attribution tracking
    const sourceDocIds: string[] = [];
    const sourceDocNames: string[] = [];
    const seenDocs = new Set<string>();
    for (const chunk of chunks.slice(0, 5)) { // Top 5 chunks
      const docId = chunk.metadata?.document_id || chunk.document_id;
      const docName = chunk.metadata?.document_name || chunk.file_name || 'Unknown';
      if (docId && !seenDocs.has(docId)) {
        seenDocs.add(docId);
        sourceDocIds.push(docId);
        sourceDocNames.push(docName);
      }
    }
    
    // Calculate conversation depth (how many messages in this session)
    const conversationDepth = conversationHistory.length + 1;
    
    // Log analytics event (anonymised - no PII) with development_id from unit lookup
    logAnalyticsEvent({
      tenantId: userTenantId,
      developmentId: userDevelopmentId,
      houseTypeCode: userHouseTypeCode || undefined,
      eventType: 'chat_question',
      eventCategory: questionTopic || 'unknown',
      eventData: {
        hasContext: chunks.length > 0,
        chunkCount: chunks.length,
        topSimilarity: topSimilarity.toFixed(3),
        avgSimilarity: avgSimilarity.toFixed(3),
        confidenceLevel,
        needsTraining,
        question_preview: message.substring(0, 100),
        verified_attribution: hasVerifiedDevelopment,
        // Source document tracking
        sourceDocIds: sourceDocIds.length > 0 ? sourceDocIds : undefined,
        sourceDocNames: sourceDocNames.length > 0 ? sourceDocNames : undefined,
        // Conversation completion tracking
        conversationDepth,
        isFollowUp: conversationDepth > 1,
      },
      sessionId: validatedUnitUid || conversationUserId,
      unitId: effectiveUnitUid,
    }).catch(() => {}); // Don't fail chat if analytics fails
    
    // Ambiguous size question clarification removed — let RAG pipeline handle all size questions

    if (drawingResult.found && drawingResult.drawing) {
      drawing = drawingResult.drawing;
      drawingExplanation = drawingResult.explanation;
      
      // Track drawing served for marketing website counter
      try {
        await logAnalyticsEvent({
          tenantId: DEFAULT_TENANT_ID,
          developmentId: DEFAULT_DEVELOPMENT_ID,
          eventType: 'document_download',
          eventCategory: 'documents',
          eventData: { 
            filename: drawing.fileName,
            source: 'chat_drawing',
            drawingType: drawing.drawingType,
          },
          sessionId: effectiveUnitUid,
          unitId: effectiveUnitUid,
        });
      } catch (_trackErr) {
          // error handled silently
      }
    }

    // DOCUMENT LINK REQUEST: Check if user is asking for a download link/preview
    let documentLink: ResolvedDocument | null = null;
    let documentLinkExplanation = '';
    
    const linkRequest = detectDocumentLinkRequest(message);
    if (linkRequest.isLinkRequest && effectiveUnitUid) {
      
      // Get context from last conversation for better matching
      const lastContext = conversationHistory.length > 0 
        ? conversationHistory[conversationHistory.length - 1].aiMessage 
        : '';
      
      const docResult = await findDocumentForLink(
        effectiveUnitUid, 
        linkRequest.documentHint, 
        lastContext,
        userSupabaseProjectId,
        userHouseTypeCode || undefined
      );
      
      if (docResult.found && docResult.document) {
        documentLink = docResult.document;
        documentLinkExplanation = docResult.explanation;
        
        // Track document served for marketing website counter
        try {
          await logAnalyticsEvent({
            tenantId: DEFAULT_TENANT_ID,
            developmentId: DEFAULT_DEVELOPMENT_ID,
            eventType: 'document_download',
            eventCategory: 'documents',
            eventData: { 
              docId: documentLink.id,
              filename: documentLink.fileName,
              source: 'chat_link',
              discipline: documentLink.discipline,
            },
            sessionId: effectiveUnitUid,
            unitId: effectiveUnitUid,
          });
        } catch (_trackErr) {
            // error handled silently
        }
        
        // Return immediately with the document link
        const linkAnswer = `${documentLinkExplanation} You can view or download it using the button below.`;
        
        // Save to database
        await persistMessageSafely({
          tenant_id: userTenantId,
          development_id: userDevelopmentId,
          unit_id: actualUnitId,
        require_unit_id: true,
          user_id: conversationUserId || null,
          unit_uid: effectiveUnitUid || null,
          user_message: message,
          ai_message: linkAnswer,
          question_topic: 'document_link_request',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            documentRequested: linkRequest.documentHint,
            documentProvided: documentLink.fileName,
          },
          request_id: requestId,
        });
        
        return NextResponse.json({
          success: true,
          answer: linkAnswer,
          source: 'document_link',
          drawing: {
            fileName: documentLink.fileName,
            drawingType: documentLink.discipline,
            drawingDescription: documentLink.title,
            houseTypeCode: documentLink.houseTypeCode,
            previewUrl: documentLink.signedUrl,
            downloadUrl: documentLink.downloadUrl,
            explanation: documentLinkExplanation,
          },
        });
      }
    }

    // Handle floor plan link requests - return attachments list
    const isFloorPlanLinkRequest = questionTopic === 'internal_floor_plans' || 
      /\b(link|show|give|send)\s*(me\s*)?(my\s*)?(floor\s*plan|floor\s*plans)\b/i.test(message) ||
      /\b(floor\s*plan|floor\s*plans)\s+(link|download|please)\b/i.test(message);
    
    if (isFloorPlanLinkRequest && effectiveUnitUid) {
      
      const floorPlanResult = await findFloorPlanDocuments(
        effectiveUnitUid,
        userSupabaseProjectId,
        userHouseTypeCode || undefined
      );
      
      if (floorPlanResult.found && floorPlanResult.attachments.length > 0) {
        const floorPlanAnswer = floorPlanResult.attachments.length === 1
          ? "Here's your floor plan. You can view or download it below."
          : `Here are your floor plans (${floorPlanResult.attachments.length} documents). You can view or download them below.`;
        
        // Save to database
        await persistMessageSafely({
          tenant_id: userTenantId,
          development_id: userDevelopmentId,
          unit_id: actualUnitId,
        require_unit_id: true,
          user_id: conversationUserId || null,
          unit_uid: effectiveUnitUid || null,
          user_message: message,
          ai_message: floorPlanAnswer,
          question_topic: 'floor_plan_link',
          source: 'purchaser_portal',
          latency_ms: Date.now() - startTime,
          metadata: {
            floorPlanCount: floorPlanResult.attachments.length,
          },
          request_id: requestId,
        });
        
        return NextResponse.json({
          success: true,
          answer: floorPlanAnswer,
          source: 'floor_plan_link',
          attachments: floorPlanResult.attachments.map(fp => ({
            id: fp.id,
            title: fp.title,
            fileName: fp.fileName,
            previewUrl: fp.signedUrl,
            downloadUrl: fp.downloadUrl,
            discipline: fp.discipline,
            docType: fp.docType,
            houseTypeCode: fp.houseTypeCode,
          })),
        });
      }
    }

    // Check for dimension question BEFORE streaming - may need to override response
    // STRICT: Only match when room keywords are explicitly paired with size/dimension words
    // Expanded to include all room types users might ask about
    const roomKeywords = 'living\\s*room|bedroom|kitchen|bathroom|utility|wc|toilet|loo|ensuite|en-?suite|master|lounge|sitting\\s*room|dining|hall|landing|garage|study|office|cloakroom|hot\\s*press|storage|cupboard|house|home|room';
    const isDimensionQuestion = questionTopic === 'room_sizes' ||
      /\b(dimension|measurement|square\s*(feet|metres?|meters?|m2|ft2?)|floor\s*area)\b/i.test(message) ||
      // Allow "my/the" to be optional — "What size is bedroom 2?" must work as well as "What size is my bedroom?"
      new RegExp(`\\bwhat\\s+size\\s+(is|are)\\s+(?:(my|the)\\s+)?(?:\\w+\\s+)?(${roomKeywords})`, 'i').test(message) ||
      new RegExp(`\\bhow\\s+(big|large|wide|long)\\s+(is|are)\\s+(?:(my|the)\\s+)?(?:\\w+\\s+)?(${roomKeywords})`, 'i').test(message) ||
      new RegExp(`\\b(${roomKeywords})\\s+\\d*\\s*(size|dimensions?|measurements?|area)\\b`, 'i').test(message) ||
      // "What are the dimensions of bedroom 2?" / "What is the size of bedroom 2?"
      new RegExp(`\\bwhat\\s+(is|are)\\s+the\\s+(size|dimensions?|measurements?|area)\\s+of\\s+(?:(my|the)\\s+)?(?:\\w+\\s+)?(${roomKeywords})`, 'i').test(message) ||
      // Direct floor/room modifier patterns
      /\b(downstairs|upstairs|ground\s*floor|first\s*floor)\s+(bathroom|wc|toilet|bedroom)\b/i.test(message) ||
      // Material/quantity questions that imply room dimensions (carpet, flooring, paint, tiles)
      new RegExp(`\\b(how\\s+much|how\\s+many|amount\\s+of)\\s+\\w*\\s*(carpet|flooring|laminate|tile[sd]?|paint|wallpaper|vinyl)\\b.*\\b(${roomKeywords})`, 'i').test(message) ||
      new RegExp(`\\b(carpet|flooring|laminate|tile|paint|wallpaper|vinyl)\\b.*\\b(${roomKeywords})\\b.*\\b(need|require|cost|buy|get)`, 'i').test(message) ||
      new RegExp(`\\b(carpet|floor|tile|paint)\\b.*\\b(the|my)\\s+(${roomKeywords})`, 'i').test(message);

    // Extract the specific room being asked about using smart matching
    const extractedRoom = isDimensionQuestion ? extractRoomFromQuestion(message) : null;

    const shouldOverrideForLiability = isDimensionQuestion && drawing && drawing.drawingType === 'room_sizes';
    const isDimensionQuestionWithNoDrawing = isDimensionQuestion && !drawing;

    // FLOOR PLAN ATTACHMENTS: For dimension/floor plan questions, fetch all floor plan documents
    const floorPlanKeywords = ['floor plan', 'drawing', 'room size', 'living room', 'bedroom', 'kitchen', 'bathroom', 'hall', 'dimension', 'size', 'layout', 'elevation', 'section', 'how big'];
    const isFloorPlanQuestion = floorPlanKeywords.some(k => message.toLowerCase().includes(k));

    let floorPlanAttachments: FloorPlanAttachment[] = [];
    if ((isDimensionQuestion || isFloorPlanQuestion) && effectiveUnitUid) {
      try {
        const fpResult = await findFloorPlanDocuments(
          effectiveUnitUid,
          userSupabaseProjectId,
          userHouseTypeCode || undefined
        );
        if (fpResult.found && fpResult.attachments.length > 0) {
          floorPlanAttachments = fpResult.attachments;
        }
      } catch (_fpErr) {
        // Floor plan lookup failed — continue without attachments
      }

      // Fallback: direct document_sections query when findFloorPlanDocuments returns nothing
      if (floorPlanAttachments.length === 0 && userHouseTypeCode && userSupabaseProjectId) {
        try {
          const fbSupabase = getSupabaseClient();
          const { data: drawingDocs } = await fbSupabase
            .from('document_sections')
            .select('id, metadata')
            .eq('project_id', userSupabaseProjectId)
            .filter('metadata->>house_type_code', 'eq', userHouseTypeCode)
            .limit(50);

          if (drawingDocs && drawingDocs.length > 0) {
            const uniqueDrawings = new Map<string, any>();
            for (const section of drawingDocs) {
              const metadata = section.metadata as any;
              const key = metadata.file_name;
              if (key && !uniqueDrawings.has(key)) {
                uniqueDrawings.set(key, metadata);
              }
            }

            for (const [key, doc] of Array.from(uniqueDrawings.entries())) {
              const fileUrl = doc.file_url || '';
              let signedUrl = fileUrl;
              let downloadUrl = fileUrl;

              if (fileUrl.includes('development_docs')) {
                try {
                  const storagePath = fileUrl.split('/development_docs/').pop() || '';
                  if (storagePath) {
                    const { data: signedData } = await fbSupabase.storage
                      .from('development_docs')
                      .createSignedUrl(storagePath, 3600);
                    if (signedData?.signedUrl) signedUrl = signedData.signedUrl;

                    const { data: downloadData } = await fbSupabase.storage
                      .from('development_docs')
                      .createSignedUrl(storagePath, 3600, { download: true });
                    if (downloadData?.signedUrl) downloadUrl = downloadData.signedUrl;
                  }
                } catch {
                  // signed URL creation failed — fall back to raw file URL
                }
              }

              floorPlanAttachments.push({
                id: doc.file_name || key,
                title: doc.title || doc.file_name || 'Floor Plan',
                fileName: doc.file_name || key,
                fileUrl,
                signedUrl,
                downloadUrl,
                discipline: doc.discipline || 'architectural',
                docType: doc.drawing_type || 'floor_plan',
                houseTypeCode: doc.house_type_code || null,
              });
            }
          }

          // Second fallback: search by filename containing house type code
          if (floorPlanAttachments.length === 0) {
            const { data: filenameDocs } = await fbSupabase
              .from('document_sections')
              .select('id, metadata')
              .eq('project_id', userSupabaseProjectId)
              .filter('metadata->>file_name', 'ilike', `%${userHouseTypeCode}%`)
              .limit(50);

            if (filenameDocs && filenameDocs.length > 0) {
              const uniqueDrawings = new Map<string, any>();
              for (const section of filenameDocs) {
                const metadata = section.metadata as any;
                const key = metadata.file_name;
                if (key && !uniqueDrawings.has(key)) {
                  uniqueDrawings.set(key, metadata);
                }
              }

              for (const [key, doc] of Array.from(uniqueDrawings.entries())) {
                const fileUrl = doc.file_url || '';
                let signedUrl = fileUrl;
                let downloadUrl = fileUrl;

                if (fileUrl.includes('development_docs')) {
                  try {
                    const storagePath = fileUrl.split('/development_docs/').pop() || '';
                    if (storagePath) {
                      const { data: signedData } = await fbSupabase.storage
                        .from('development_docs')
                        .createSignedUrl(storagePath, 3600);
                      if (signedData?.signedUrl) signedUrl = signedData.signedUrl;

                      const { data: downloadData } = await fbSupabase.storage
                        .from('development_docs')
                        .createSignedUrl(storagePath, 3600, { download: true });
                      if (downloadData?.signedUrl) downloadUrl = downloadData.signedUrl;
                    }
                  } catch {
                    // signed URL creation failed — fall back to raw file URL
                  }
                }

                floorPlanAttachments.push({
                  id: doc.file_name || key,
                  title: doc.title || doc.file_name || 'Floor Plan',
                  fileName: doc.file_name || key,
                  fileUrl,
                  signedUrl,
                  downloadUrl,
                  discipline: doc.discipline || 'architectural',
                  docType: doc.drawing_type || 'floor_plan',
                  houseTypeCode: doc.house_type_code || null,
                });
              }
            }
          }
        } catch (_fbErr) {
          // Fallback query failed — continue without attachments
        }
      }
    }

    // ROOM DIMENSION INJECTION: Look up actual dimensions from unit_room_dimensions table
    // and inject them into the system prompt so the LLM can give precise answers
    // NOTE: unit_room_dimensions may be stored under the legacy supabase_project_id (57dc3919)
    // rather than the unit's development_id (e0833063), so try both.
    let roomDimensionData: RoomDimensionResult | null = null;
    if (isDimensionQuestion && extractedRoom) {
      try {
        const dimSupabase = getSupabaseClient();
        // Try primary development_id first
        roomDimensionData = await lookupRoomDimensions(
          dimSupabase,
          userTenantId,
          userDevelopmentId,
          userHouseTypeCode || undefined,
          actualUnitId || undefined,
          extractedRoom
        );
        // Fallback: try legacy supabase_project_id if primary didn't find data
        const legacyProjectId = userUnitDetails.unitInfo?.supabase_project_id;
        if (!roomDimensionData?.found && legacyProjectId && legacyProjectId !== userDevelopmentId) {
          roomDimensionData = await lookupRoomDimensions(
            dimSupabase,
            userTenantId,
            legacyProjectId,
            userHouseTypeCode || undefined,
            actualUnitId || undefined,
            extractedRoom
          );
        }
        if (roomDimensionData?.found) {
          const dimParts: string[] = [];
          if (roomDimensionData.length_m && roomDimensionData.width_m) {
            dimParts.push(`${roomDimensionData.width_m}m x ${roomDimensionData.length_m}m`);
          }
          if (roomDimensionData.area_sqm) {
            dimParts.push(`${roomDimensionData.area_sqm} sq m`);
          }
          const dimStr = dimParts.join(', ');
          const roomLabel = roomDimensionData.roomName || extractedRoom.displayName;
          systemMessage = systemMessage + `\n\nROOM DIMENSIONS (from verified database):\n${roomLabel}: ${dimStr}\nUse these exact dimensions when answering. For carpet/flooring calculations, multiply width x length to get the area needed.`;
        }
      } catch (_dimErr) {
        // Dimension lookup failed — continue without, LLM will use reference data or floor plan
      }
    }

    // LANGUAGE INSTRUCTION: Add language-specific instruction to system message
    // This MUST be at the end for maximum effect and must be very explicit
    const languageInstructions: Record<string, string> = {
      en: '', // No additional instruction needed for English
      pl: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Polish (Polski). Every single word of your response must be in Polish. Do NOT use English under any circumstances. This is a strict requirement.',
      es: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Spanish (Español). Every single word of your response must be in Spanish. Do NOT use English under any circumstances. This is a strict requirement.',
      ru: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Russian (Русский). Every single word of your response must be in Russian. Do NOT use English under any circumstances. This is a strict requirement.',
      pt: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Portuguese (Português). Every single word of your response must be in Portuguese. Do NOT use English under any circumstances. This is a strict requirement.',
      lv: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Latvian (Latviešu). Every single word of your response must be in Latvian. Do NOT use English under any circumstances. This is a strict requirement.',
      lt: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Lithuanian (Lietuvių). Every single word of your response must be in Lithuanian. Do NOT use English under any circumstances. This is a strict requirement.',
      ro: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Romanian (Română). Every single word of your response must be in Romanian. Do NOT use English under any circumstances. This is a strict requirement.',
      ga: '\n\n=== MANDATORY LANGUAGE REQUIREMENT ===\nYou MUST respond ONLY in Irish (Gaeilge). Every single word of your response must be in Irish. Do NOT use English under any circumstances. This is a strict requirement.',
    };

    const languageInstruction = languageInstructions[selectedLanguage] || '';
    if (languageInstruction) {
      systemMessage = systemMessage + languageInstruction;
    }

    // STEP 5: Generate Response with STREAMING
    
    // Build messages array with conversation history for context
    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemMessage },
    ];
    
    // Add recent conversation history so the AI understands follow-up questions
    if (conversationHistory.length > 0) {
      for (const exchange of conversationHistory) {
        chatMessages.push({ role: 'user', content: exchange.userMessage });
        chatMessages.push({ role: 'assistant', content: exchange.aiMessage });
      }
    }
    
    // Add the current user message
    chatMessages.push({ role: 'user', content: message });

    // Dimension handler early return removed — RAG pipeline now handles all dimension
    // questions using room size documents in document_sections. Floor plan drawings
    // are still attached via the drawing metadata in the streaming response.

    // Select model based on question complexity
    const selectedModel = selectChatModel(message, chunks ?? [], activeIntentKey);

    // TEST MODE: Return JSON response instead of streaming for test harness
    if (testMode) {
      const completion = await getOpenAIClient().chat.completions.create({
        model: selectedModel,
        messages: chatMessages,
        temperature: 0.3,
        max_tokens: 800,
        stream: false,
      });
      
      let fullAnswer = cleanMarkdownFormatting(completion.choices[0]?.message?.content || '');
      const latencyMs = Date.now() - startTime;
      
      // AMENITY HALLUCINATION CHECK: Block fabricated venue names, travel times, distances
      // CRITICAL: If we're in the LLM path, we do NOT have grounded POI data - never bypass validation
      // The POI path returns early via formatPOIResponse, so if we're here, we don't have real venue data
      const hasAmenityContext = false; // LLM path never has grounded POI context
      const hallucinationCheck = detectAmenityHallucinations(fullAnswer, hasAmenityContext);
      
      if (hallucinationCheck.hasHallucination) {
        fullAnswer = hallucinationCheck.cleanedAnswer || fullAnswer;
        
        // Log the blocked hallucination
        try {
          const { logAnswerGap } = await import('@/lib/assistant/gap-logger');
          await logAnswerGap({
            scheme_id: userSupabaseProjectId,
            unit_id: clientUnitUid || null,
            user_question: message,
            intent_type: 'validation_failed',
            attempted_sources: ['llm'],
            final_source: 'validation_rewrite',
            gap_reason: 'amenity_hallucination_blocked',
            details: { blocked_claims: hallucinationCheck.detectedIssues },
          });
        } catch (_logError) {
            // error handled silently
        }
      }
      
      // ESCALATION GUIDANCE: Append helpful contact guidance when no documents
      const responseSource = chunks && chunks.length > 0 ? 'semantic_search' : 'no_documents';
      
      if (escalationGuidance && responseSource === 'no_documents' && isEscalationEnabled()) {
        const effectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
        if (isEscalationAllowedForIntent(effectiveIntent)) {
          const escalationText = formatEscalationGuidance(escalationGuidance);
          if (escalationText) {
            const cleanEscalationText = cleanForDisplay(escalationText);
            fullAnswer = fullAnswer.trim() + '\n\n' + cleanEscalationText;
          } else {
          }
        } else {
        }
      }
      
      // NEXT BEST ACTION: Append capability-safe follow-up suggestions
      let nbaDebugInfo: NextBestActionResult | null = null;
      let nbaSuggestionUsed: string | null = null;

      if (capabilityContext && isNextBestActionEnabled()) {
        const effectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
        const nbaResult = appendNextBestAction(fullAnswer, effectiveIntent, responseSource, capabilityContext, selectedLanguage as string);
        fullAnswer = nbaResult.response;
        nbaSuggestionUsed = nbaResult.suggestionUsed;
        nbaDebugInfo = nbaResult.debugInfo;

        if (nbaSuggestionUsed) {
        }
      }
      
      // TONE GUARDRAILS: Apply consistent "local guide" voice
      if (isToneGuardrailsEnabled()) {
        const toneInput: ResponseStyleInput = {
          intentType: intentClassification?.intent || detectIntentFromMessage(message) || 'general',
          safetyIntercept: false,
          confidence: chunks && chunks.length > 0 ? 'high' : 'low',
          sourceType: responseSource === 'semantic_search' ? 'docs' : 'general',
          schemeName: developmentName ?? undefined,
          includeSourceHint: true,
        };
        fullAnswer = wrapResponse(fullAnswer, toneInput);
      }
      
      // HALLUCINATION FIREWALL: Validate grounding and block unverified claims
      let firewallResult: FirewallResult | null = null;
      if (isHallucinationFirewallEnabled()) {
        const effectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
        const firewallInput: FirewallInput = {
          answerText: fullAnswer,
          intent: effectiveIntent,
          source: responseSource,
          metadata: {
            hasPlacesData: false,
            hasArchiveMatch: chunks && chunks.length > 0,
            archiveConfidence: chunks?.[0]?.similarity,
            hasApprovedFacts: false,
            schemeId: DEFAULT_DEVELOPMENT_ID,
            isPlaybook: false,
            isSchemeProfile: false,
          },
          citations: chunks?.slice(0, 3).map((c) => (c.metadata?.file_name as string) || 'document'),
        };
        
        firewallResult = enforceGrounding(firewallInput);
        
        if (firewallResult.modified) {
          fullAnswer = firewallResult.safeAnswerText;
        }
      }
      
      // MARKDOWN CLEANUP: Remove any remaining markdown tokens
      fullAnswer = cleanForDisplay(fullAnswer);
      
      // Save to database
      await persistMessageSafely({
        tenant_id: userTenantId,
        development_id: userDevelopmentId,
        unit_id: actualUnitId,
        require_unit_id: true,
        user_id: conversationUserId || null,
        unit_uid: validatedUnitUid || null,
        user_message: message,
        ai_message: fullAnswer,
        question_topic: questionTopic,
        source: 'purchaser_portal',
        latency_ms: latencyMs,
        metadata: {
          userId: userId || null,
          chunksUsed: chunks?.length || 0,
          model: 'gpt-4o-mini',
          testMode: true,
          nextBestAction: nbaSuggestionUsed,
        },
        request_id: requestId,
      });

      // FLOOR PLAN DOCUMENTS: Attach architectural documents for floor plan related questions
      const floorPlanTriggers = ['floor plan','room size','living room','bedroom','kitchen','bathroom','hall','dimension','size','layout','elevation','section','how big','drawing'];
      const isFloorPlanQ = floorPlanTriggers.some(k => (message || '').toLowerCase().includes(k));

      let responseDocuments: { id: string; title: string; file_url: string; type: string }[] = [];
      if (isFloorPlanQ && userHouseTypeCode && userSupabaseProjectId) {
        const fpDocSupabase = getSupabaseClient();
        const { data: archDocs } = await fpDocSupabase
          .from('document_sections')
          .select('id, metadata')
          .eq('project_id', userSupabaseProjectId)
          .eq('metadata->>discipline', 'architectural')
          .eq('metadata->>house_type_code', userHouseTypeCode);

        if (archDocs) {
          const seen = new Map<string, { id: string; title: string; file_url: string; type: string }>();
          for (const doc of archDocs) {
            const meta = doc.metadata as any;
            const src = meta?.source;
            const url = meta?.file_url;
            if (src && url && !seen.has(src)) {
              seen.set(src, {
                id: doc.id,
                title: src.replace(/-/g,' ').replace(/\.[^.]+$/,''),
                file_url: url,
                type: 'floor_plan'
              });
            }
          }
          responseDocuments = Array.from(seen.values());
        }
      }

      return NextResponse.json({
        success: true,
        answer: fullAnswer,
        source: responseSource,
        chunksUsed: chunks?.length || 0,
        safetyIntercept: false,
        suggested_questions: generateFollowUpQuestions(activeIntentKey || 'documents', message),
        documents: responseDocuments,
      });
    }

    // Create streaming response
    const stream = await getOpenAIClient().chat.completions.create({
      model: selectedModel,
      messages: chatMessages,
      temperature: 0.3,
      max_tokens: 800,
      stream: true,
    });

    // Create a TransformStream for the response
    const encoder = new TextEncoder();
    let fullAnswer = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata as first chunk (including sources for transparency)
          // CRITICAL: Only show sources that are ACTUALLY RELEVANT to the question topic
          const sourceDocumentsMap = new Map<string, { name: string; date: string | null; similarity: number }>();
          
          // MINIMUM SIMILARITY FOR SHOWING SOURCES - adaptive based on topic specificity
          const MIN_SOURCE_SIMILARITY = 0.35; // Base threshold
          const HIGH_SIMILARITY_BOOST = 0.42; // Higher threshold for topic-specific filtering
          
          // Map question topic (from extractQuestionTopic) to document categories
          // This uses the already-extracted questionTopic for consistency
          const topicToDocCategories: Record<string, string[]> = {
            'ev_charger': ['ohme', 'epod', 'ev charger', 'electric vehicle', 'charging'],
            'heat_pump': ['daikin', 'altherma', 'heat pump', 'heating', 'erga', 'hvac'],
            'heating': ['daikin', 'altherma', 'heat pump', 'heating', 'boiler', 'radiator', 'erga'],
            'solar': ['solar', 'pv', 'photovoltaic', 'panels'],
            'ventilation': ['mvhr', 'ventilation', 'hrv', 'air quality', 'lunos'],
            'security': ['alarm', 'security', 'sensor', 'intruder'],
            'floor_plan': ['floor plan', 'elevation', 'drawing', '-dr-a-', 'layout'],
            'room_sizes': ['floor plan', 'room sizes', 'dimensions', 'layout'],
            'living_room_size': ['floor plan', 'room sizes', 'layout'],
            'kitchen': ['kitchen', 'appliance', 'oven', 'hob', 'bosch', 'siemens'],
            'parking': ['parking', 'car park', 'transport'],
            'waste': ['bin', 'waste', 'recycling', 'rubbish'],
          };
          
          // Documents that should be EXCLUDED when asking about specific topics
          // Key = topic, Value = patterns to exclude (prevent cross-contamination)
          const topicExclusions: Record<string, RegExp> = {
            'ev_charger': /\b(daikin|altherma|erga|heat\s*pump|hvac|boiler|radiator)\b/i,
            'heat_pump': /\b(ohme|epod|ev\s*charg|electric\s*vehicle)\b/i,
            'heating': /\b(ohme|epod|ev\s*charg|electric\s*vehicle)\b/i,
          };
          
          // Documents that are always excluded from sources (too technical/confusing)
          const isExcludedDocument = (fileName: string): boolean => {
            const lower = fileName.toLowerCase();
            return /\b(sds|datasheet|bba.*cert|technical.*spec|castleforma|raft.*therm|render.*agreement|br_render|iso.*cert)\b/.test(lower);
          };
          
          // Check if document is relevant to the question topic
          const isDocumentRelevantToTopic = (fileName: string, chunk: DocumentChunk, topic: string | null): boolean => {
            const lower = fileName.toLowerCase();
            const chunkContent = (chunk.content || '').toLowerCase();
            const docCategory = (chunk.metadata?.category || '').toLowerCase();
            const docDiscipline = (chunk.metadata?.discipline || '').toLowerCase();
            
            // First, check topic-specific exclusions (e.g., exclude heat pumps from EV charger questions)
            if (topic && topicExclusions[topic]) {
              if (topicExclusions[topic].test(lower)) {
                return false; // Explicitly excluded for this topic
              }
            }
            
            // For specific topics, check if document matches
            if (topic && topicToDocCategories[topic]) {
              const relevantPatterns = topicToDocCategories[topic];
              // Check filename, content, or metadata for relevance
              const isRelevant = relevantPatterns.some(pattern => 
                lower.includes(pattern) || 
                chunkContent.includes(pattern) ||
                docCategory.includes(pattern) ||
                docDiscipline.includes(pattern)
              );
              return isRelevant;
            }
            
            // For general/unknown topics, allow most documents except technical ones
            return true;
          };
          
          // Check if this is a topic with specific document requirements
          const hasSpecificTopic = questionTopic && topicToDocCategories[questionTopic];
          const effectiveThreshold = hasSpecificTopic ? HIGH_SIMILARITY_BOOST : MIN_SOURCE_SIMILARITY;
          const hasRelevantChunks = chunks && chunks.length > 0 && chunks[0]?.similarity >= MIN_SOURCE_SIMILARITY;
          
          // Skip sources for high-risk topics or when no chunks are relevant
          if (!highRiskCheck.isHighRisk && hasRelevantChunks) {
            for (const c of chunks) {
              const fileName = c.metadata?.file_name || c.metadata?.source || 'Document';
              const similarity = c.similarity || 0;
              
              // Only include sources above the relevance threshold
              if (similarity < MIN_SOURCE_SIMILARITY) continue;
              
              // Always exclude confusing technical documents
              if (isExcludedDocument(fileName)) continue;
              
              // For specific topics, check document relevance
              if (hasSpecificTopic) {
                const isRelevant = isDocumentRelevantToTopic(fileName, c, questionTopic);
                if (!isRelevant) {
                  // Allow FAQs/guides as fallback only if they have very high similarity
                  const isFAQ = /\b(faq|guide|manual|homeowner)\b/.test(fileName.toLowerCase());
                  if (!isFAQ || similarity < 0.48) continue;
                }
              }
              
              if (!sourceDocumentsMap.has(fileName) || (similarity > sourceDocumentsMap.get(fileName)!.similarity)) {
                const uploadedAt = c.metadata?.uploaded_at || c.created_at;
                const dateStr = uploadedAt ? new Date(uploadedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null;
                sourceDocumentsMap.set(fileName, { name: fileName, date: dateStr, similarity });
              }
              if (sourceDocumentsMap.size >= 3) break;
            }
          }
          
          // Sort by similarity and take top 3
          const sourceDocuments = Array.from(sourceDocumentsMap.values())
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3)
            .map(({ name, date }) => ({ name, date }));
          
          // Detect BER and warranty queries for rich cards
          const berKeywords = /\b(ber|building energy rating|energy rating|energy certificate|energy label|a1 rated|a2 rated|a3 rated|nzeb|near zero energy)\b/i;
          const warrantyKeywords = /\b(warranty|structural warranty|homebond|premier guarantee|defect|10 year|latent defect|snag(ging)?|builder guarantee)\b/i;

          // FLOOR PLAN DOCUMENTS: Attach architectural documents for floor plan related questions (streaming)
          const streamFloorPlanTriggers = ['floor plan','room size','living room','bedroom','kitchen','bathroom','hall','dimension','size','layout','elevation','section','how big','drawing'];
          const streamIsFloorPlanQ = streamFloorPlanTriggers.some(k => (message || '').toLowerCase().includes(k));

          let streamResponseDocuments: { id: string; title: string; file_url: string; type: string }[] = [];
          if (streamIsFloorPlanQ && userHouseTypeCode && userSupabaseProjectId) {
            const fpDocSupabase = getSupabaseClient();
            const { data: archDocs } = await fpDocSupabase
              .from('document_sections')
              .select('id, metadata')
              .eq('project_id', userSupabaseProjectId)
              .eq('metadata->>discipline', 'architectural')
              .eq('metadata->>house_type_code', userHouseTypeCode);

            if (archDocs) {
              const seen = new Map<string, { id: string; title: string; file_url: string; type: string }>();
              for (const doc of archDocs) {
                const meta = doc.metadata as any;
                const src = meta?.source;
                const url = meta?.file_url;
                if (src && url && !seen.has(src)) {
                  seen.set(src, {
                    id: doc.id,
                    title: src.replace(/-/g,' ').replace(/\.[^.]+$/,''),
                    file_url: url,
                    type: 'floor_plan'
                  });
                }
              }
              streamResponseDocuments = Array.from(seen.values());
            }
          }

          const metadata = {
            type: 'metadata',
            source: chunks && chunks.length > 0 ? 'semantic_search' : 'no_documents',
            chunksUsed: chunks?.length || 0,
            sources: sourceDocuments,
            suggested_questions: generateFollowUpQuestions(activeIntentKey || intentClassification?.intent || 'documents', message),
            documents: streamResponseDocuments,
            drawing: drawing ? {
              fileName: drawing.fileName,
              drawingType: drawing.drawingType,
              drawingDescription: drawing.drawingDescription,
              houseTypeCode: drawing.houseTypeCode,
              previewUrl: drawing.signedUrl,
              downloadUrl: drawing.downloadUrl,
              explanation: drawingExplanation,
            } : null,
            ber_card: berKeywords.test(message) ? { rating: 'A2', label: 'Near Zero Energy' } : null,
            warranty_card: warrantyKeywords.test(message) ? { developer_years: 2, structural_years: 10, providers: ['HomeBond', 'Premier Guarantee'] } : null,
            attachments: floorPlanAttachments.length > 0 ? floorPlanAttachments.map(fp => ({
              id: fp.id,
              title: fp.title,
              fileName: fp.fileName,
              previewUrl: fp.signedUrl,
              downloadUrl: fp.downloadUrl,
              discipline: fp.discipline,
              docType: fp.docType,
              houseTypeCode: fp.houseTypeCode,
            })) : null,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

          // TONE GUARDRAILS: Create streaming guardrail for chunk processing
          const streamResponseSource = chunks && chunks.length > 0 ? 'semantic_search' : 'no_documents';
          const streamToneInput: ResponseStyleInput = {
            intentType: intentClassification?.intent || detectIntentFromMessage(message) || 'general',
            safetyIntercept: false,
            confidence: chunks && chunks.length > 0 ? 'high' : 'low',
            sourceType: streamResponseSource === 'semantic_search' ? 'docs' : 'general',
            schemeName: developmentName ?? undefined,
            includeSourceHint: true,
          };
          const streamingGuardrail = createStreamingGuardrail(streamToneInput);
          
          // Stream the intro chunk first (before LLM response)
          const introChunk = streamingGuardrail.getIntroChunk();
          if (introChunk) {
            fullAnswer += introChunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: introChunk })}\n\n`));
          }
          
          // Stream the AI response (clean asterisks and apply tone guardrails from each chunk)
          for await (const chunk of stream) {
            const rawContent = chunk.choices[0]?.delta?.content || '';
            if (rawContent) {
              // Clean markdown formatting from streamed content
              let content = cleanMarkdownFormatting(rawContent);
              // Apply streaming guardrail (removes em-dashes on-the-fly)
              content = streamingGuardrail.processChunk(content);
              fullAnswer += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content })}\n\n`));
            }
          }

          // ESCALATION GUIDANCE: Append helpful contact guidance when no documents (streaming)
          
          if (escalationGuidance && streamResponseSource === 'no_documents' && isEscalationEnabled()) {
            const streamEffectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
            if (isEscalationAllowedForIntent(streamEffectiveIntent)) {
              const escalationText = formatEscalationGuidance(escalationGuidance);
              if (escalationText) {
                const cleanEscalationText = cleanForDisplay(escalationText);
                const escalationContent = '\n\n' + cleanEscalationText;
                fullAnswer += escalationContent;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: escalationContent })}\n\n`));
              } else {
              }
            } else {
            }
          }
          
          // NEXT BEST ACTION: Append capability-safe follow-up suggestions to streaming response
          let streamNbaSuggestion: string | null = null;

          if (capabilityContext && isNextBestActionEnabled()) {
            const streamEffectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
            const streamNbaResult = appendNextBestAction('', streamEffectiveIntent, streamResponseSource, capabilityContext, selectedLanguage as string);

            if (streamNbaResult.suggestionUsed) {
              streamNbaSuggestion = streamNbaResult.suggestionUsed;
              const nbaContent = '\n\n' + streamNbaSuggestion;
              fullAnswer += nbaContent;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: nbaContent })}\n\n`));
            }
          }
          
          // TONE GUARDRAILS: Add source hint at end of streaming response
          if (isToneGuardrailsEnabled() && streamResponseSource === 'semantic_search') {
            // Translate source hint based on language
            const sourceHintTranslations: Record<string, string> = {
              en: 'Source: Your home documentation',
              pl: 'Źródło: Dokumentacja Twojego domu',
              es: 'Fuente: La documentación de tu hogar',
              ru: 'Источник: Документация вашего дома',
              pt: 'Fonte: A documentação da sua casa',
              lv: 'Avots: Jūsu mājas dokumentācija',
              lt: 'Šaltinis: Jūsų namų dokumentacija',
              ro: 'Sursă: Documentația locuinței tale',
              ga: 'Foinse: Doiciméadú do thí',
            };
            const sourceHintBase = sourceHintTranslations[selectedLanguage] || sourceHintTranslations.en;
            const sourceHintContent = '\n\n' + sourceHintBase + (developmentName ? ` for ${developmentName}` : '');
            fullAnswer += sourceHintContent;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: sourceHintContent })}\n\n`));
          }
          
          // Contact card detection: phone/email in response
          const contactCardPhoneMatch = fullAnswer?.match(/\+?[\d\s\-]{10,15}/);
          const contactCardEmailMatch = fullAnswer?.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          const contactNameMatch = fullAnswer?.match(/(?:contact|reach|speak to|ask for|speak with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
          const contactCard = (contactCardPhoneMatch || contactCardEmailMatch) ? {
            name: contactNameMatch?.[1] || null,
            phone: contactCardPhoneMatch?.[0]?.trim() || null,
            email: contactCardEmailMatch?.[0]?.trim() || null,
          } : null;

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', contact_card: contactCard })}\n\n`));
          controller.close();

          // Save to database after streaming completes
          const latencyMs = Date.now() - startTime;
          
          // TONE GUARDRAILS: Apply final cleanup to complete response for storage
          // Uses processStreamedResponse to apply phrase replacements, em-dash removal, and formatting
          if (isToneGuardrailsEnabled()) {
            fullAnswer = processStreamedResponse(fullAnswer, streamToneInput);
          }
          
          // HALLUCINATION FIREWALL: Validate grounding for stored response
          // Note: Cannot block content already streamed, but logs violations and cleans stored version
          let streamFirewallResult: FirewallResult | null = null;
          if (isHallucinationFirewallEnabled()) {
            const streamEffectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
            const streamFirewallInput: FirewallInput = {
              answerText: fullAnswer,
              intent: streamEffectiveIntent,
              source: streamResponseSource,
              metadata: {
                hasPlacesData: false,
                hasArchiveMatch: chunks && chunks.length > 0,
                archiveConfidence: chunks?.[0]?.similarity,
                hasApprovedFacts: false,
                schemeId: DEFAULT_DEVELOPMENT_ID,
              },
              citations: chunks?.slice(0, 3).map((c) => (c.metadata?.file_name as string) || 'document'),
            };
            
            streamFirewallResult = enforceGrounding(streamFirewallInput);
            
            if (streamFirewallResult.modified) {
              fullAnswer = streamFirewallResult.safeAnswerText;
              
              // Log the violation for observability
              try {
                const { logAnswerGap } = await import('@/lib/assistant/gap-logger');
                await logAnswerGap({
                  scheme_id: userSupabaseProjectId,
                  unit_id: clientUnitUid || null,
                  user_question: message,
                  intent_type: 'validation_failed',
                  attempted_sources: ['llm_streaming'],
                  final_source: 'firewall_blocked',
                  gap_reason: 'validation_failed',
                  details: { 
                    violations: streamFirewallResult.violations,
                    already_sent: true,
                    firewall_diagnostics: getFirewallDiagnostics(streamFirewallResult)
                  },
                });
              } catch (_logError) {
                  // error handled silently
              }
            }
          }
          
          // MARKDOWN CLEANUP: Remove any remaining markdown tokens from stored response
          fullAnswer = cleanForDisplay(fullAnswer);

          // STREAMING HALLUCINATION CHECK: Detect and log fabricated venue names in streamed responses
          // CRITICAL: If we're in the streaming LLM path, we do NOT have grounded POI data
          // The POI path returns early, so if we're here, never bypass validation
          const streamHasAmenityContext = false; // Streaming LLM path never has grounded POI context
          const streamHallucinationCheck = detectAmenityHallucinations(fullAnswer, streamHasAmenityContext);
          
          let answerToStore = fullAnswer;
          if (streamHallucinationCheck.hasHallucination) {
            answerToStore = streamHallucinationCheck.cleanedAnswer || fullAnswer;
            
            // Log the hallucination for observability
            try {
              const { logAnswerGap } = await import('@/lib/assistant/gap-logger');
              await logAnswerGap({
                scheme_id: userSupabaseProjectId,
                unit_id: clientUnitUid || null,
                user_question: message,
                intent_type: 'validation_failed',
                attempted_sources: ['llm_streaming'],
                final_source: 'validation_detected',
                gap_reason: 'amenity_hallucination_blocked',
                details: { blocked_claims: streamHallucinationCheck.detectedIssues, already_sent: true },
              });
            } catch (_logError) {
                // error handled silently
            }
          }

          await persistMessageSafely({
            tenant_id: userTenantId,
            development_id: userDevelopmentId,
            unit_id: actualUnitId,
        require_unit_id: true,
            user_id: conversationUserId || null,
            unit_uid: validatedUnitUid || null,
            user_message: message,
            ai_message: answerToStore,
            question_topic: questionTopic,
            source: 'purchaser_portal',
            latency_ms: latencyMs,
            metadata: {
              userId: userId || null,
              chunksUsed: chunks?.length || 0,
              model: 'gpt-4o-mini',
              streaming: true,
              hallucinationDetected: streamHallucinationCheck.hasHallucination,
            },
            request_id: requestId,
          });
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Streaming failed' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    logCritical('Chat', 'Chat API failed', requestId, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    const errorLogger = createErrorLogger('/api/chat', DEFAULT_TENANT_ID, DEFAULT_DEVELOPMENT_ID);
    const isTimeout = error instanceof Error && error.message.includes('timeout');
    const isLLM = error instanceof Error && (error.message.includes('OpenAI') || error.message.includes('rate limit'));
    
    if (isTimeout) {
      await errorLogger.timeout(error instanceof Error ? error.message : 'Chat timeout');
    } else if (isLLM) {
      await errorLogger.llm(error instanceof Error ? error.message : 'LLM error', undefined, { endpoint: '/api/chat' });
    } else {
      await errorLogger.supabase(error instanceof Error ? error.message : 'Chat failed', undefined, { endpoint: '/api/chat' });
    }
    
    const errorCode = isTimeout ? 'TIMEOUT' : isLLM ? 'LLM_ERROR' : 'SERVER_ERROR';
    return NextResponse.json(
      createStructuredError(error instanceof Error ? error.message : 'Chat failed', requestId, {
        error_code: errorCode,
        retryable: true,
      }),
      { status: 500, headers: getResponseHeaders(requestId) }
    );
  }
}
