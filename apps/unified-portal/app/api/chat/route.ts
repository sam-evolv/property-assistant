import { NextRequest, NextResponse } from 'next/server';
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
import { isLocalHistoryQuery, detectHistoryCategory, formatLocalHistoryResponse, isLongviewOrRathardScheme, isYesIntent } from '@/lib/assistant/local-history';
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
import { getNearbyPOIs, formatPOIResponse, formatSchoolsResponse, formatShopsResponse, formatGroupedSchoolsResponse, formatLocalAmenitiesResponse, detectPOICategory, detectPOICategoryExpanded, isLocationMissingReason, dedupeAndFillAmenities, type POICategory, type FormatPOIOptions, type POIResult, type GroupedSchoolsData, type GroupedAmenitiesData } from '@/lib/places/poi';
import { validateAmenityAnswer, createValidationContext, hasDistanceMatrixData, detectAmenityHallucinations } from '@/lib/assistant/amenity-answer-validator';
import { 
  enforceGrounding, 
  getFirewallDiagnostics,
  type FirewallInput,
  type FirewallResult
} from '@/lib/assistant/hallucination-firewall';
import { isHallucinationFirewallEnabled } from '@/lib/assistant/grounding-policy';
import { cleanForDisplay, sanitizeForChat } from '@/lib/assistant/formatting';
import { isEscalationAllowedForIntent } from '@/lib/assistant/escalation';

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || '127.0.0.1';
}

const CONVERSATION_HISTORY_LIMIT = 4; // Load last 4 exchanges for context

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Room name extraction from questions
const ROOM_NAME_PATTERNS: Record<string, RegExp[]> = {
  'utility': [/\butility\b/i, /\blaundry\b/i, /\bstorage\b/i],
  'living_room': [/\bliving\s*room\b/i, /\bsitting\s*room\b/i, /\blounge\b/i, /\bfront\s*room\b/i],
  'kitchen': [/\bkitchen\b/i],
  'kitchen_dining': [/\bkitchen\s*\/?\s*dining\b/i, /\bkitchen\s+dining\b/i, /\bopen\s+plan\s+kitchen\b/i],
  'dining': [/\bdining\s*room\b/i, /\bdining\s*area\b/i],
  'bedroom_1': [/\b(?:master|main|primary)\s*bedroom\b/i, /\bbedroom\s*(?:1|one)\b/i],
  'bedroom_2': [/\bbedroom\s*(?:2|two)\b/i, /\bsecond\s*bedroom\b/i],
  'bedroom_3': [/\bbedroom\s*(?:3|three)\b/i, /\bthird\s*bedroom\b/i],
  'bedroom_4': [/\bbedroom\s*(?:4|four)\b/i, /\bfourth\s*bedroom\b/i],
  'bathroom': [/\bbathroom\b/i, /\bmain\s*bathroom\b/i, /\bfamily\s*bathroom\b/i],
  'ensuite': [/\ben-?suite\b/i, /\bmaster\s*bath\b/i],
  'toilet': [/\btoilet\b/i, /\bwc\b/i, /\bcloakroom\b/i, /\bpowder\s*room\b/i],
  'hall': [/\bhall(?:way)?\b/i, /\bentrance\b/i, /\bfoyer\b/i],
  'landing': [/\blanding\b/i],
  'garage': [/\bgarage\b/i, /\bcar\s*port\b/i],
  'study': [/\bstudy\b/i, /\boffice\b/i, /\bbox\s*room\b/i],
};

function extractRoomNameFromQuestion(question: string): { roomKey: string; roomName: string } | null {
  const lowerQuestion = question.toLowerCase();

  for (const [roomKey, patterns] of Object.entries(ROOM_NAME_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuestion)) {
        // Convert room_key to display name
        const roomName = roomKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return { roomKey, roomName };
      }
    }
  }

  return null;
}

// Look up room dimensions from Supabase
interface RoomDimensionResult {
  found: boolean;
  roomName?: string;
  length_m?: number;
  width_m?: number;
  area_sqm?: number;
  ceiling_height_m?: number;
  verified?: boolean;
  source?: string;
}

async function lookupRoomDimensions(
  supabase: ReturnType<typeof getSupabaseClient>,
  tenantId: string,
  developmentId: string,
  houseTypeCode: string | undefined,
  unitId: string | undefined,
  roomKey: string
): Promise<RoomDimensionResult> {
  try {
    console.log(`[Chat] Looking up room dimensions for ${roomKey}, houseTypeCode=${houseTypeCode}, unit=${unitId}, dev=${developmentId}`);

    // First, we need to get the house_type_id from unit_types table if we have a house type code
    let houseTypeId: string | undefined;
    if (houseTypeCode) {
      const { data: unitTypeData } = await supabase
        .from('unit_types')
        .select('id')
        .eq('name', houseTypeCode)
        .limit(1);

      if (unitTypeData && unitTypeData.length > 0) {
        houseTypeId = unitTypeData[0].id;
        console.log(`[Chat] Resolved house type code ${houseTypeCode} to ID ${houseTypeId}`);
      }
    }

    // Strategy 1: Try unit-specific dimensions first
    if (unitId) {
      const { data: unitData, error: unitError } = await supabase
        .from('unit_room_dimensions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('unit_id', unitId)
        .eq('room_key', roomKey)
        .order('verified', { ascending: false })
        .limit(1);

      if (!unitError && unitData && unitData.length > 0) {
        const dim = unitData[0];
        console.log(`[Chat] Found unit-specific room dimension: ${dim.room_name} = ${dim.area_sqm}m²`);
        return {
          found: true,
          roomName: dim.room_name,
          length_m: dim.length_m ? parseFloat(dim.length_m) : undefined,
          width_m: dim.width_m ? parseFloat(dim.width_m) : undefined,
          area_sqm: dim.area_sqm ? parseFloat(dim.area_sqm) : undefined,
          ceiling_height_m: dim.ceiling_height_m ? parseFloat(dim.ceiling_height_m) : undefined,
          verified: dim.verified,
          source: dim.source,
        };
      }
    }

    // Strategy 2: Try house-type-level dimensions
    if (houseTypeId) {
      const { data: houseTypeData, error: htError } = await supabase
        .from('unit_room_dimensions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('house_type_id', houseTypeId)
        .eq('room_key', roomKey)
        .is('unit_id', null)
        .order('verified', { ascending: false })
        .limit(1);

      if (!htError && houseTypeData && houseTypeData.length > 0) {
        const dim = houseTypeData[0];
        console.log(`[Chat] Found house-type-level room dimension: ${dim.room_name} = ${dim.area_sqm}m²`);
        return {
          found: true,
          roomName: dim.room_name,
          length_m: dim.length_m ? parseFloat(dim.length_m) : undefined,
          width_m: dim.width_m ? parseFloat(dim.width_m) : undefined,
          area_sqm: dim.area_sqm ? parseFloat(dim.area_sqm) : undefined,
          ceiling_height_m: dim.ceiling_height_m ? parseFloat(dim.ceiling_height_m) : undefined,
          verified: dim.verified,
          source: dim.source,
        };
      }
    }

    // Strategy 3: Try development-wide search for any matching room
    const { data: devData, error: devError } = await supabase
      .from('unit_room_dimensions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('development_id', developmentId)
      .eq('room_key', roomKey)
      .order('verified', { ascending: false })
      .limit(1);

    if (!devError && devData && devData.length > 0) {
      const dim = devData[0];
      console.log(`[Chat] Found development-level room dimension: ${dim.room_name} = ${dim.area_sqm}m²`);
      return {
        found: true,
        roomName: dim.room_name,
        length_m: dim.length_m ? parseFloat(dim.length_m) : undefined,
        width_m: dim.width_m ? parseFloat(dim.width_m) : undefined,
        area_sqm: dim.area_sqm ? parseFloat(dim.area_sqm) : undefined,
        ceiling_height_m: dim.ceiling_height_m ? parseFloat(dim.ceiling_height_m) : undefined,
        verified: dim.verified,
        source: dim.source,
      };
    }

    console.log(`[Chat] No room dimensions found for ${roomKey}`);
    return { found: false };
  } catch (err) {
    console.error(`[Chat] Error looking up room dimensions:`, err);
    return { found: false };
  }
}

function formatRoomDimensionAnswer(dim: RoomDimensionResult, roomName: string): string {
  if (!dim.found) {
    return `I don't have the specific dimensions for the ${roomName} stored yet. I've included the floor plan below which should have the accurate room measurements.`;
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
    return `I don't have complete dimension data for the ${roomName}. I've included the floor plan below which should have the accurate measurements.`;
  }

  if (dim.ceiling_height_m) {
    answer += ` with a ceiling height of ${dim.ceiling_height_m}m`;
  }

  answer += '.';

  // Add disclaimer
  answer += '\n\n_Please note: These dimensions are provided as a guide only. For exact measurements, please refer to the official floor plans attached below._';

  return answer;
}

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
const DEFAULT_DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
const MAX_CHUNKS = 20; // Limit context to top 20 most relevant chunks
const MAX_CONTEXT_CHARS = 80000; // Max characters in context (~20k tokens)

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
  metadata: Record<string, any>;
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
      console.error('[Chat] Message persist BLOCKED - missing unit_id (required):', {
        request_id: params.request_id,
        unit_uid: params.unit_uid,
        unit_id: params.unit_id,
      });
      return { success: false, error: errorMsg };
    }
    
    const validUserId = isValidUUID(params.user_id) ? params.user_id! : null;
    const validUnitId = isValidUUID(params.unit_id) ? params.unit_id! : null;
    
    // Log warning if unit_id is missing (for analytics tracking)
    if (!validUnitId) {
      console.warn('[Chat] Message persisted WITHOUT unit_id:', {
        request_id: params.request_id,
        unit_uid: params.unit_uid,
        require_unit_id: params.require_unit_id,
      });
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
    console.error('[Chat] Message persist failed:', {
      request_id: params.request_id,
      unit_uid: params.unit_uid,
      unit_id: params.unit_id,
      user_id: params.user_id,
      error: errorMsg,
    });
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
async function getUserUnitDetails(unitUid: string): Promise<{ address: string | null; houseType: string | null; unitInfo: UnitInfo | null }> {
  if (!unitUid) return { address: null, houseType: null, unitInfo: null };
  
  try {
    const unitInfo = await getUnitInfo(unitUid);
    
    if (!unitInfo) {
      console.log('[Chat] Could not fetch unit details from either database');
      return { address: null, houseType: null, unitInfo: null };
    }
    
    console.log('[Chat] Unit info loaded:', {
      id: unitInfo.id,
      house_type_code: unitInfo.house_type_code,
      development_id: unitInfo.development_id,
      tenant_id: unitInfo.tenant_id,
    });
    
    return {
      address: unitInfo.address || null,
      houseType: unitInfo.house_type_code || null,
      unitInfo: unitInfo,
    };
  } catch (err) {
    console.error('[Chat] Error fetching unit details:', err);
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
function getChunkHouseTypeCode(chunk: any): string | null {
  const metadata = chunk.metadata || {};
  const drawingClassification = metadata.drawing_classification || {};
  const fileName = metadata.file_name || metadata.source || '';
  
  return metadata.house_type_code || 
         drawingClassification.houseTypeCode || 
         extractHouseTypeFromFilename(fileName);
}

// Parse embedding from Supabase (may be string, array, or object)
function parseEmbedding(emb: any): number[] | null {
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
    console.log('[Chat] Skipping history load - user not properly identified');
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
    console.error('[Chat] Error loading conversation history:', error);
    return [];
  }
}

// Expand a follow-up query with context from previous messages
function expandQueryWithContext(currentMessage: string, history: { userMessage: string; aiMessage: string }[]): string {
  if (history.length === 0) return currentMessage;
  
  // Get the most recent exchange for context
  const lastExchange = history[history.length - 1];
  
  // Build a context-aware query for semantic search
  const contextQuery = `Previous topic: ${lastExchange.userMessage}\nCurrent question: ${currentMessage}`;
  
  console.log('[Chat] Expanded query for semantic search:', contextQuery.slice(0, 100) + '...');
  return contextQuery;
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const clientIP = getClientIP(request);

  const rateCheck = checkRateLimit(clientIP, '/api/chat');
  if (!rateCheck.allowed) {
    console.log(`[Chat] Rate limit exceeded for ${clientIP} requestId=${requestId}`);
    return NextResponse.json(
      createStructuredError('Too many requests', requestId, {
        error_code: 'RATE_LIMITED',
        retryable: true,
      }),
      { status: 429, headers: { ...getResponseHeaders(requestId), 'retry-after': String(Math.ceil(rateCheck.resetMs / 1000)) } }
    );
  }

  console.log('\n============================================================');
  console.log('[Chat] RAG CHAT API - SEMANTIC SEARCH MODE');
  console.log('[Chat] PROJECT_ID:', PROJECT_ID, `requestId=${requestId}`);
  console.log('============================================================');

  const startTime = Date.now();
  
  // TEST MODE: Allow test harness to get JSON responses instead of streaming
  const { searchParams } = new URL(request.url);
  const testMode = searchParams.get('test_mode') === 'json';
  if (testMode) {
    console.log('[Chat] TEST MODE ENABLED - will return JSON instead of streaming');
  }

  // DIAGNOSTIC MODE: Enable debug output for places-diagnostics testing
  const isPlacesDiagnosticsMode = request.headers.get('X-Test-Mode') === 'places-diagnostics';
  const testSecret = request.headers.get('X-Test-Secret');
  const expectedSecret = process.env.ASSISTANT_TEST_SECRET || process.env.TEST_SECRET;
  const isDiagnosticsAuthenticated = isPlacesDiagnosticsMode && testSecret && expectedSecret && testSecret === expectedSecret;
  
  if (isDiagnosticsAuthenticated) {
    console.log('[Chat] DIAGNOSTICS MODE ENABLED - will include debug info in response');
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
      console.log(`[Chat] Payload too large: ${contentLength} bytes requestId=${requestId}`);
      return NextResponse.json(
        createStructuredError('Payload too large', requestId, { error_code: 'PAYLOAD_TOO_LARGE' }),
        { status: 413, headers: getResponseHeaders(requestId) }
      );
    }

    const body = await request.json();
    const { message, unitUid: clientUnitUid, userId, hasBeenWelcomed, intentMetadata, lastIntentKey } = body;
    
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
      console.log(`[Chat] Message too long: ${message.length} chars requestId=${requestId}`);
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
      
      console.log('[Chat] Assistant OS intent:', intentClassification.intent, 'tier:', intentClassification.emergencyTier, 'mode:', answerStrategy.mode);
      
      // Handle tiered emergency responses
      if (intentClassification.emergencyTier === 1) {
        const tier1Response = getTier1Response();
        console.log('[Chat] TIER 1 EMERGENCY: Life safety risk detected');
        
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
        console.log('[Chat] TIER 2 EMERGENCY: Property emergency detected');
        
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
        console.log('[Chat] TIER 3: Non-urgent maintenance issue detected');
        
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
        console.log('[Chat] Humor request detected - serving joke');
        
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
      console.log('[Chat] SAFETY INTERCEPT: Query blocked by pre-filter, matched keyword:', safetyCheck.matchedKeyword);
      
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
      console.log('[Chat] Safety intercept logged to database');
      
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
          console.log('[Chat] Token validated, unit derived from token:', validatedUnitUid);
        } else {
          console.log('[Chat] Token validation failed - drawings will not be accessible');
        }
      } catch (tokenError) {
        console.log('[Chat] Token validation error - drawings will not be accessible:', tokenError);
      }
    } else {
      console.log('[Chat] No token provided - drawings will not be accessible for security');
    }

    console.log('🔍 Search Query:', message);

    // Establish effective unit UID with fallback chain for drawing lookup
    const effectiveUnitUid = validatedUnitUid || clientUnitUid || null;
    console.log('[Chat] Effective unit UID for drawings:', effectiveUnitUid || 'none');

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
    // For Supabase queries (document_sections), we need the Supabase project_id which may differ from Drizzle development_id
    // TODO: In a multi-tenant system, implement proper tenant → supabase_project_id mapping
    // Currently: Falls back to PROJECT_ID only when tenant matches DEFAULT_TENANT_ID (Longview)
    // This prevents cross-tenant data leakage in multi-tenant deployments
    const userSupabaseProjectId = userUnitDetails.unitInfo?.supabase_project_id 
      || (userTenantId === DEFAULT_TENANT_ID ? PROJECT_ID : null);
    
    // Determine scheme resolution path for diagnostics
    let schemeResolutionPath = 'unknown';
    if (userUnitDetails.unitInfo?.supabase_project_id) {
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
      console.log('[Chat] SCHEME RESOLUTION FAILED: Cannot determine Supabase project_id for tenant:', userTenantId, 'unitUid:', effectiveUnitUid);
      chatDiagnostics.fallback_reason = 'missing_scheme_id';
      
      const errorResponse: any = {
        success: true,
        answer: "I'm unable to access your development's knowledge base at the moment. Please try again later or contact your management company for assistance.",
        source: 'tenant_config_error',
      };
      
      if (isDiagnosticsAuthenticated) {
        errorResponse.debug = chatDiagnostics;
      }
      
      return NextResponse.json(errorResponse, { headers: { 'x-request-id': requestId } });
    }
    
    console.log('[Chat] User unit address:', userUnitDetails.address || 'unknown');
    console.log('[Chat] User house type code:', userHouseTypeCode || 'none (will use all house types)');
    console.log('[Chat] User tenant/development:', userTenantId, '/', userDevelopmentId, '(Supabase:', userSupabaseProjectId, ')');
    
    const gdprCheck = detectOtherUnitQuestion(message, userUnitDetails.address);
    
    // HIGH-RISK TOPIC DETECTION: Check if this is a safety/emergency question
    const highRiskCheck = detectHighRiskTopic(message);
    if (highRiskCheck.isHighRisk) {
      console.log('[Chat] HIGH-RISK TOPIC detected:', highRiskCheck.category);
    }
    
    if (gdprCheck.isAboutOtherUnit) {
      console.log('[Chat] GDPR BLOCK: Question about other unit detected:', gdprCheck.mentionedUnit);
      
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

    // LOCAL HISTORY: Handle history/heritage queries for Longview Park and Rathard Park
    const developmentName = userUnitDetails?.unitInfo?.development_name || null;
    if (isLocalHistoryQuery(message) && isLongviewOrRathardScheme(developmentName)) {
      console.log('[Chat] Local history query detected for:', developmentName);
      
      const historyCategory = detectHistoryCategory(message);
      const historyResponse = formatLocalHistoryResponse(historyCategory);
      
      await persistMessageSafely({
        tenant_id: userTenantId,
        development_id: userDevelopmentId,
        unit_id: actualUnitId,
        require_unit_id: true,
        user_id: validatedUnitUid || userId || null,
        unit_uid: validatedUnitUid || null,
        user_message: message,
        ai_message: historyResponse,
        question_topic: 'local_history',
        source: 'purchaser_portal',
        latency_ms: Date.now() - startTime,
        metadata: {
          assistantOS: true,
          intent: 'local_history',
          historyCategory: historyCategory,
          developmentName: developmentName,
          userId: userId || null,
        },
        request_id: requestId,
      });
      
      return NextResponse.json({
        success: true,
        answer: historyResponse,
        source: 'local_history',
        isNoInfo: false,
        metadata: {
          intent: 'local_history',
          historyCategory: historyCategory,
        },
      });
    }

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
        console.log('[Chat] Session memory updated:', sessionMemoryUpdatedKeys.join(', '));
      }
      
      if (hasRelevantMemory(sessionMemory)) {
        console.log('[Chat] Session memory context available:', 
          sessionMemory.block ? `block=${sessionMemory.block}` : '',
          sessionMemory.room ? `room=${sessionMemory.room}` : '',
          sessionMemory.appliance ? `appliance=${sessionMemory.appliance}` : '',
          sessionMemory.issue ? `issue=${sessionMemory.issue}` : ''
        );
      }
      
      // Generate debug info for observability
      sessionMemoryDebug = getMemoryDebugInfo(sessionMemory, sessionMemoryUpdatedKeys);
    }

    // AFFIRMATIVE INTENT: Handle "yes", "sure", "please" by routing to the previous follow-up suggestion
    const isAffirmativeMessage = intentClassification?.intent === 'affirmative' || isYesIntent(message);
    if (isAssistantOSEnabled() && isAffirmativeMessage) {
      console.log('[Chat] AFFIRMATIVE INTENT detected - checking for previous follow-up context');
      
      // Load conversation history to find the previous assistant message
      const history = await loadConversationHistory(
        validatedUnitUid || clientUnitUid || userId || '',
        userTenantId,
        userDevelopmentId
      );
      
      if (history.length > 0) {
        const lastAssistantMessage = history[history.length - 1].aiMessage;
        
        // LOCAL HISTORY FOLLOW-UP: Check if last message offered another history fact
        const isLocalHistoryFollowUp = lastAssistantMessage.includes('Would you like to hear another interesting fact about the area');
        if (isLocalHistoryFollowUp && isLongviewOrRathardScheme(developmentName)) {
          console.log('[Chat] AFFIRMATIVE: Routing to local history follow-up');
          
          const historyResponse = formatLocalHistoryResponse(null);
          
          await persistMessageSafely({
            tenant_id: userTenantId,
            development_id: userDevelopmentId,
            unit_id: actualUnitId,
        require_unit_id: true,
            user_id: validatedUnitUid || userId || null,
            unit_uid: validatedUnitUid || null,
            user_message: message,
            ai_message: historyResponse,
            question_topic: 'local_history',
            source: 'purchaser_portal',
            latency_ms: Date.now() - startTime,
            metadata: {
              assistantOS: true,
              intent: 'local_history_followup',
              developmentName: developmentName,
              userId: userId || null,
            },
            request_id: requestId,
          });
          
          return NextResponse.json({
            success: true,
            answer: historyResponse,
            source: 'local_history',
            isNoInfo: false,
            metadata: {
              intent: 'local_history_followup',
            },
          });
        }
        
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
          console.log('[Chat] AFFIRMATIVE: Extracted follow-up topic:', extractedTopic);
          
          // Map the extracted topic to POI categories
          const categories = getFollowUpCategories(extractedTopic);
          
          if (categories && categories.length > 0) {
            console.log('[Chat] AFFIRMATIVE: Routing to POI categories:', categories);
            
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
              console.log('[Chat] AFFIRMATIVE: Re-classified as location_amenities for:', poiCategoryResult.category);
            }
          }
        }
        
        if (intentClassification?.intent === 'affirmative') {
          // Couldn't extract a follow-up topic - provide helpful response
          console.log('[Chat] AFFIRMATIVE: Could not extract follow-up topic from previous message');
          
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
        console.log('[Chat] LOCATION_AMENITIES: Using dynamic keyword search for:', dynamicKeyword);
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
          
          const dynamicResponseObj: any = {
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
          console.error('[Chat] Dynamic keyword search failed:', err);
          // Fall through to generic fallback
        }
      }
      
      if (!poiCategory) {
        // Could not determine POI category - provide generic response, DO NOT fall through to RAG
        console.log('[Chat] LOCATION_AMENITIES: Could not determine POI category, using fallback');
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
        
        const fallbackResponseObj: any = {
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
      
      console.log('[Chat] LOCATION_AMENITIES: Detected category:', poiCategory, 'expandedIntent:', expandedIntent, 'for scheme:', userSupabaseProjectId);
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
          console.log('[Chat] EXPANDED INTENT:', expandedIntent, 'fetching categories:', expandedCategories);
          
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
          console.log('[Chat] AMENITY GATE: Serving stale cache due to:', diagnostics.failure_reason);
        }
        
        // STRICT GATE: If no results, DO NOT fall through to RAG - provide controlled fallback
        if (poiData.results.length === 0) {
          console.log('[Chat] AMENITY GATE: No Places results, using controlled fallback');
          
          const isMissingLocation = isLocationMissingReason(diagnostics?.failure_reason);
          const categoryName = poiCategory.replace(/_/g, ' ');
          
          let noResultsResponse: string;
          if (isMissingLocation) {
            noResultsResponse = `The development location hasn't been set up yet, so I'm not able to search for nearby places at the moment. Your developer should be able to sort that out.`;
          } else {
            noResultsResponse = `I couldn't find any ${categoryName} close by – it's possible there aren't any within a reasonable distance. You could try Google Maps for a wider search around ${schemeAddress || 'the area'}.`;
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
          
          const noResultsResponseObj: any = {
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
          console.log('[Chat] AMENITY FALLBACK:', {
            schemeId: userSupabaseProjectId,
            fallback_reason: chatDiagnostics.fallback_reason || gapReason,
            category: poiCategory,
            location_present: chatDiagnostics.scheme_location.present,
          });
          
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
        if (expandedIntent === 'schools' && groupedSchoolsData) {
          poiResponse = formatGroupedSchoolsResponse(groupedSchoolsData, developmentName || undefined);
        } else if (expandedIntent === 'local_amenities' && groupedAmenitiesData) {
          poiResponse = formatLocalAmenitiesResponse(groupedAmenitiesData, developmentName || undefined);
        } else if (expandedIntent === 'shops') {
          poiResponse = formatShopsResponse(poiData, developmentName || undefined);
        } else {
          poiResponse = formatPOIResponse(poiData, formatOptions);
        }
        
        console.log('[Chat] POI response generated, from_cache:', poiData.from_cache, 'results:', poiData.results.length);
        
        // OPTIONAL DOCUMENT AUGMENTATION: Enhance Places response with scheme documentation
        // Documents can ONLY augment, never replace place names, distances, or rankings
        const { getAmenityDocContext, formatAugmentedResponse, buildMultiSourceHint } = await import('@/lib/assistant/amenity-augmenter');
        
        let docAugmentUsed = false;
        try {
          const docContext = await getAmenityDocContext(userDevelopmentId, poiCategory, message);
          if (docContext.found) {
            poiResponse = formatAugmentedResponse(poiResponse, docContext);
            docAugmentUsed = true;
            console.log('[Chat] Amenity response augmented with docs:', docContext.documentTitles);
            
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
        } catch (augmentError) {
          console.log('[Chat] Document augmentation skipped:', augmentError);
        }
        
        // Build multi-source hint
        const sourceHint = buildMultiSourceHint(true, poiData.fetched_at, docAugmentUsed);
        
        // Generate response first, then persist safely (never fail the response)
        const successResponseObj: any = {
          success: true,
          answer: poiResponse,
          source: docAugmentUsed ? 'google_places_with_docs' : 'google_places',
          safetyIntercept: false,
          isNoInfo: false,
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
        console.error('[Chat] AMENITY GATE: POI engine error, using controlled fallback:', poiError);
        
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
        } catch (gapLogError) {
          console.error('[Chat] Gap log failed:', gapLogError);
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
        
        const errorResponseObj: any = {
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
        console.log('[Chat] AMENITY API ERROR:', {
          schemeId: userSupabaseProjectId,
          fallback_reason: 'api_error',
          category: poiCategory,
          error: poiError instanceof Error ? poiError.message : 'Unknown error',
        });
        
        return NextResponse.json(errorResponseObj);
      }
    }

    // STEP 0: Load conversation history for context-aware responses
    // Use effective unit UID (validated token OR client-provided) as user identifier for session isolation
    // This ensures conversation continuity even when QR token validation fails but client unit UID exists
    const conversationUserId = effectiveUnitUid || userId || '';
    const conversationHistory = await loadConversationHistory(conversationUserId, userTenantId, userDevelopmentId);
    console.log('[Chat] Loaded', conversationHistory.length, 'previous exchanges for context');
    
    // Check if this is a follow-up question that needs context expansion
    const needsContext = isFollowUpQuestion(message) && conversationHistory.length > 0;
    const searchQuery = needsContext 
      ? expandQueryWithContext(message, conversationHistory)
      : message;
    
    if (needsContext) {
      console.log('[Chat] Follow-up detected, using expanded query for semantic search');
    }

    // STEP 1: Generate embedding for the search query (may be expanded with context)
    console.log('[Chat] Generating query embedding...');
    const embeddingResponse = await getOpenAIClient().embeddings.create({
      model: 'text-embedding-3-small',
      input: searchQuery,
      dimensions: 1536,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('[Chat] Query embedding generated');

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
      supersededDocIds = new Set((superseded as any[]).map(r => r.id));
      if (supersededDocIds.size > 0) {
        console.log('[Chat] Filtering out', supersededDocIds.size, 'superseded documents from RAG');
      }
    } catch (e) {
      console.log('[Chat] Could not check superseded docs:', e);
    }
    
    // Fetch ALL chunks with embeddings for proper semantic search
    // Use Supabase project_id (not Drizzle development_id) for document_sections queries
    console.log('[Chat] Loading document chunks for Supabase project:', userSupabaseProjectId);
    console.log('[Chat] Supabase URL configured:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('[Chat] Supabase key configured:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    let allChunks: any[] | null = null;
    let supabaseError: string | null = null;
    
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from('document_sections')
        .select('id, content, metadata, embedding')
        .eq('project_id', userSupabaseProjectId);

      if (fetchError) {
        console.error('[Chat] Supabase query error:', fetchError.message, fetchError.details, fetchError.hint);
        supabaseError = fetchError.message;
      } else {
        allChunks = data;
      }
    } catch (supabaseErr) {
      console.error('[Chat] Supabase connection failed:', supabaseErr);
      supabaseError = supabaseErr instanceof Error ? supabaseErr.message : 'Connection failed';
    }

    if (supabaseError || !allChunks) {
      console.error('[Chat] Cannot proceed without document chunks. Error:', supabaseError);
      return NextResponse.json({
        success: false,
        error: 'Unable to access knowledge base',
        details: supabaseError || 'No documents found',
        answer: "I'm sorry, I'm currently unable to access the property information system. Please try again in a moment, or contact your development's support team if the issue persists.",
      }, { status: 503 });
    }

    console.log('[Chat] Loaded', allChunks?.length || 0, 'total chunks');

    // Calculate similarity scores for ALL chunks
    let chunks: any[] = [];
    if (allChunks && allChunks.length > 0) {
      console.log('[Chat] Computing semantic similarity scores...');
      
      // DRAWING INTENT DETECTION: Only include floor plans if question is about drawings/dimensions
      const isDrawingRelatedQuestion = /\b(floor\s*plan|drawing|layout|dimensions?|room\s*size|measurements?|square\s*(feet|metres?|meters?|ft|m2)|how\s+(big|large)\s+(is|are)|what\s+size|internal\s+layout|elevation|section)\b/i.test(message);
      console.log('[Chat] Drawing-related question:', isDrawingRelatedQuestion);
      
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
      const EXCLUDED_DISCIPLINES = [
        'structural', 'engineering', 'electrical', 'mechanical', 'plumbing',
        'mep', 'hvac', 'fire_strategy', 'fire_engineering', 'gas', 'construction',
        'as_built', 'detailed_design', 'technical', 'contractor'
      ];
      
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
        console.log('[Chat] Filtered to', activeChunks.length, 'chunks after removing superseded + technical + wrong house type docs (from', allChunks.length, ')');
        if (userHouseTypeCode) {
          console.log('[Chat] House type filter active: only showing documents for', userHouseTypeCode);
        }
      }
      
      const scoredChunks = activeChunks.map(chunk => {
        // Parse and calculate semantic similarity using embeddings
        let similarity = 0;
        const parsedEmbedding = parseEmbedding(chunk.embedding);
        if (parsedEmbedding) {
          similarity = cosineSimilarity(queryEmbedding, parsedEmbedding);
        }
        
        // Boost score for keyword matches (hybrid search)
        const keywords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const contentLower = (chunk.content || '').toLowerCase();
        const metadataStr = JSON.stringify(chunk.metadata || {}).toLowerCase();
        
        let keywordBoost = 0;
        keywords.forEach((kw: string) => {
          if (contentLower.includes(kw)) keywordBoost += 0.05;
          if (metadataStr.includes(kw)) keywordBoost += 0.03;
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
      // This prevents forcing irrelevant context into the prompt
      const MIN_RELEVANCE_SIMILARITY = 0.25; // Raw cosine similarity threshold
      const topChunkSimilarity = scoredChunks[0]?.similarity || 0;
      
      if (topChunkSimilarity < MIN_RELEVANCE_SIMILARITY) {
        console.log('[Chat] Top chunk similarity', topChunkSimilarity.toFixed(3), 'below threshold', MIN_RELEVANCE_SIMILARITY);
        console.log('[Chat] Treating as "no relevant information found"');
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
      
      console.log('[Chat] Selected', chunks.length, 'most relevant chunks');
      if (chunks.length > 0) {
        console.log('[Chat] Top chunk scores:', chunks.slice(0, 3).map(c => ({
          score: c.score.toFixed(3),
          similarity: c.similarity.toFixed(3),
          source: c.metadata?.file_name || 'unknown'
        })));
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
    console.log('[Chat] isFirstMessage:', isFirstMessage, '(hasBeenWelcomed:', hasBeenWelcomed, ', historyLength:', conversationHistory.length, ')');
    
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
    console.log('[Chat] Support level:', supportLevel, '(top similarity:', (chunks[0]?.similarity || 0).toFixed(3), ')');
    
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
- You may suggest the user contact the developer or management company for more details`;
        
        case 'none':
        default:
          return `FOLLOW-UP OFFERS (RESTRICTED):
- You do NOT have sufficient information to offer any follow-up assistance on this topic
- NEVER say phrases like "feel free to ask", "if you need specific recommendations", "just ask for more details"
- State honestly that you don't have detailed information and redirect to developer/management company
- Do not invite further questions about topics you cannot answer`;
      }
    };

    if (chunks && chunks.length > 0) {
      const referenceData = chunks
        .map((chunk: any) => chunk.content)
        .join('\n---\n');

      const sources = Array.from(new Set(chunks.map((c: any) => c.metadata?.file_name || c.metadata?.source || 'Document')));

      systemMessage = `You are a friendly on-site concierge for a residential development. Think of yourself as a helpful neighbour who knows the estate inside out - approachable, calm, and practical.

PERSONALITY & TONE:
- Be warm and conversational, like a friendly local who genuinely wants to help
- Use clear, natural Irish/UK English (favour "colour" over "color", "centre" over "center", etc.)
- Keep answers concise: 2-5 short paragraphs maximum for most questions
- No corporate jargon or over-the-top enthusiasm - just calm, practical helpfulness

GREETING BEHAVIOUR:
${isFirstMessage ? `- This is the homeowner's first message. Start with a brief, warm welcome (one sentence max), then answer their question directly.` : `- This is a follow-up message. Do NOT repeat any welcome or greeting - just answer the question directly.`}

${hasRelevantMemory(sessionMemory) ? `${getMemoryContext(sessionMemory)}
Use this context naturally when relevant - don't explicitly mention "you mentioned earlier" unless it adds value.

` : ''}ANSWERING STYLE:
- Get straight to the point - answer the question first, then add helpful context if needed
- Only use bullet points or headings when they genuinely improve clarity, not by default
- Reference the homeowner's house type or development context when it's clearly useful, but don't repeat their full address every time

${getFollowUpInstruction()}

FORMATTING RULES (CRITICAL):
- NEVER use asterisks (*) or markdown formatting in your responses
- For section headings, just use the title followed by a colon on its own line (e.g. "Walls:" not "**Walls:**")
- For emphasis, use plain language rather than bold or italics
- Use simple dashes (-) for bullet points, not asterisks
- Keep formatting clean and professional - no special characters for styling

REFERENCE DATA (from: ${sources.join(', ')}):
--- BEGIN REFERENCE DATA ---
${referenceData}
--- END REFERENCE DATA ---

CRITICAL - NO GUESSING (ACCURACY REQUIREMENT):
- ONLY answer based on the REFERENCE DATA provided above. Do NOT make up, guess, or infer information that is not explicitly stated.
- If the answer is NOT in the reference data, explain gracefully that you don't have those specific details, and suggest they check with their developer or management company. Keep the tone helpful and conversational, not robotic.
- NEVER fabricate specifications, dates, contact details, prices, or any factual claims
- If you're uncertain whether something is accurate, err on the side of caution and direct the user to verify with the appropriate party
- It is better to admit you don't know than to provide incorrect information

CRITICAL - NEARBY AMENITIES (STRICT PROHIBITION):
- NEVER invent, guess, or name specific businesses, shops, cafes, pubs, restaurants, or any other venues
- NEVER provide walking/driving times or distances to any place unless you have explicit data
- NEVER claim a business is "in X Shopping Centre" or "on X Street" unless explicitly stated in the reference data
- If asked about local cafes, shops, pubs, restaurants, or any nearby amenities: say you can help if they ask specifically about nearby places, or suggest they check Google Maps for the most up-to-date local information
- Do NOT make up names like "Costa Coffee" or locations like "Ballyvolane Shopping Centre" - this causes serious user distrust

CRITICAL - HIGH-RISK TOPICS (SAFETY & LEGAL REQUIREMENT):
You are NOT qualified to advise on the following topics. For these, provide only general guidance and redirect to appropriate professionals:

- MEDICAL/HEALTH: If anyone mentions illness, injury, or health concerns, say: "I'm not able to give medical advice. For health concerns, please contact your GP or call NHS 111. For emergencies, call 999 or 112 immediately."

- LEGAL MATTERS: For questions about contracts, warranties, liability, or legal disputes, say: "I can't provide legal advice. For legal questions about your property, please consult a solicitor."

- STRUCTURAL SAFETY: If asked about cracks, subsidence, load-bearing walls, or structural concerns, say: "I can't assess structural safety - that requires a professional inspection. Please contact a structural engineer or your developer's warranty provider."

- FIRE SAFETY: For questions about fire alarms, escape routes, fire doors, or fire compliance, say: "Fire safety is critical and requires professional assessment. Please contact your local fire service for guidance or check with your management company."

- ELECTRICAL/GAS: For electrical faults, gas smells, boiler issues, or utility concerns, say: "Electrical and gas issues can be dangerous. Please contact a registered electrician (for electrical) or Gas Networks Ireland / Gas Emergency 0800 111 999 (for gas). For suspected gas leaks, leave the property and call the emergency line immediately."

- EMERGENCIES: If anyone mentions an emergency, fire, flood, or danger, say: "For emergencies, please call 999 or 112 immediately. Your safety is the priority."

SAFETY & LIABILITY RULES (MANDATORY):

You must never give structural, electrical, plumbing, gas, heating system repair, load-bearing, or fire-safety advice beyond quoting official documents.

You must never tell a user that a wall is safe to remove, drill into, or modify.

You must never confirm whether any installation, appliance, or structural element is working correctly, safe, compliant, or permissible to alter.

You must never diagnose defects, hazards, or risks.

If asked about safety-critical topics, you must respond ONLY with:

High-level educational information (non-prescriptive)

References to official documents

A clear redirection to qualified professionals or emergency services

If a user asks a safety-critical question (structural, electrical, gas, load-bearing, fire risk, mould, leaks, heating failure, appliance failure, or anything that could cause harm), respond with this pattern:

Acknowledge the concern

Say you cannot give safety or structural advice

Point to the correct professional route (builder, electrician, fire service, warranty provider)

If relevant, reference the homeowner manual section on reporting defects

You must NOT guess or infer safety information from drawings, floor plans, or general documents.
If something is unclear or not explicitly stated, you MUST say you do not know.

Emergency rule:
If a user indicates immediate danger (smell of gas, burning smell, electrical arcing, sparking, major leak, structural movement), instruct them to immediately contact emergency services (999 or 112) or a licensed professional. Do not provide further guidance.

CRITICAL - ROOM DIMENSIONS (LIABILITY REQUIREMENT):
- NEVER provide specific room dimensions, measurements, or sizes (in metres, feet, or any unit)
- If asked about room sizes, dimensions, floor area, or measurements, respond with:
  "I've popped the floor plan below for you - that'll have the accurate room dimensions."
- Do NOT quote any measurements from the documents - always direct users to check the official drawings themselves

CRITICAL - GDPR PRIVACY PROTECTION (LEGAL REQUIREMENT):
- You MUST ONLY discuss information about the logged-in homeowner's own unit${userUnitDetails.address ? ` (${userUnitDetails.address})` : ''}
- NEVER provide any information about other residents' homes, units, or properties under any circumstances
- If asked about another unit, neighbour's home, or any other resident's property, respond with:
  "I'm afraid I can only provide information about your own home, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes."
- You ARE allowed to discuss: general development/estate information, community amenities, shared facilities, local area information
- You are NOT allowed to discuss: any specific unit that is not the logged-in user's home, other residents' details, neighbour's properties`;

      // SUGGESTED PILLS V2: Apply intent playbook enhancement when intent metadata is present
      if (activeIntentKey) {
        const intentPlaybook = getIntentPlaybook(activeIntentKey);
        if (intentPlaybook) {
          const intentPrompt = buildIntentSystemPrompt(intentPlaybook);
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${intentPrompt}\n\n---\n\n${systemMessage}`;
          console.log('[Chat] Intent playbook applied:', activeIntentKey);
        } else {
          // Always apply Global Safety Contract even without a specific playbook
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${systemMessage}`;
          console.log('[Chat] Global Safety Contract applied (no playbook for intent):', activeIntentKey);
        }
      }

      console.log('[Chat] Context loaded:', referenceData.length, 'chars from', chunks.length, 'chunks');
      
      // Update capability context now that we know documents are available
      capabilityContext = buildCapabilityContext({
        hasDocuments: true,
        hasSchemeLocation: !!userUnitDetails?.address,
        placesApiWorking: !!process.env.GOOGLE_PLACES_API_KEY,
        hasSessionMemory: isSessionMemoryEnabled() && hasRelevantMemory(sessionMemory),
        hasUnitInfo: !!userUnitDetails?.unitInfo,
        hasFloorPlans: chunks.some((c: any) => c.metadata?.file_name?.toLowerCase().includes('floor')),
        hasDrawings: chunks.some((c: any) => c.metadata?.file_name?.toLowerCase().includes('drawing')),
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
      systemMessage = `You are a friendly on-site concierge for a residential development. Unfortunately, there are no documents uploaded yet for this development that answer this question. 

${hasRelevantMemory(sessionMemory) ? `${getMemoryContext(sessionMemory)}
Use this context naturally when relevant.

` : ''}CRITICAL - NO GUESSING (ACCURACY REQUIREMENT):
- You do NOT have reference data for this question. Explain gracefully that you don't have those specific details, and suggest they check with their developer or management company. Keep the tone helpful and conversational, not robotic.
- NEVER make up, guess, or infer any information whatsoever
- Do not provide any factual claims about the property, development, or any specifications

CRITICAL - NEARBY AMENITIES (STRICT PROHIBITION):
- NEVER invent, guess, or name specific businesses, shops, cafes, pubs, restaurants, or any other venues
- NEVER provide walking/driving times or distances to any place
- If asked about local cafes, shops, pubs, restaurants, or any nearby amenities: say you can help if they ask specifically about nearby places, or suggest they check Google Maps for the most up-to-date local information
- Do NOT make up names like "Costa Coffee" or locations like "Ballyvolane Shopping Centre"

FOLLOW-UP OFFERS (STRICTLY FORBIDDEN):
- You do NOT have information on this topic
- NEVER say phrases like "feel free to ask", "if you need specific recommendations", "just ask for more details", or "I can help with..."
- Do NOT invite further questions about topics you cannot answer
- Simply acknowledge you don't have the information and redirect to the developer/management company

CRITICAL - HIGH-RISK TOPICS (SAFETY & LEGAL REQUIREMENT):
You are NOT qualified to advise on the following topics:

- MEDICAL/HEALTH: Say: "I'm not able to give medical advice. For health concerns, please contact your GP or call NHS 111. For emergencies, call 999 or 112 immediately."
- LEGAL MATTERS: Say: "I can't provide legal advice. For legal questions about your property, please consult a solicitor."
- STRUCTURAL SAFETY: Say: "I can't assess structural safety - that requires a professional inspection. Please contact a structural engineer or your developer's warranty provider."
- FIRE SAFETY: Say: "Fire safety is critical and requires professional assessment. Please contact your local fire service for guidance or check with your management company."
- ELECTRICAL/GAS: Say: "Electrical and gas issues can be dangerous. Please contact a registered electrician (for electrical) or Gas Networks Ireland / Gas Emergency 0800 111 999 (for gas). For suspected gas leaks, leave the property and call the emergency line immediately."
- EMERGENCIES: Say: "For emergencies, please call 999 or 112 immediately. Your safety is the priority."

SAFETY & LIABILITY RULES (MANDATORY):

You must never give structural, electrical, plumbing, gas, heating system repair, load-bearing, or fire-safety advice beyond quoting official documents.

You must never tell a user that a wall is safe to remove, drill into, or modify.

You must never confirm whether any installation, appliance, or structural element is working correctly, safe, compliant, or permissible to alter.

You must never diagnose defects, hazards, or risks.

If asked about safety-critical topics, you must respond ONLY with:

High-level educational information (non-prescriptive)

References to official documents

A clear redirection to qualified professionals or emergency services

If a user asks a safety-critical question (structural, electrical, gas, load-bearing, fire risk, mould, leaks, heating failure, appliance failure, or anything that could cause harm), respond with this pattern:

Acknowledge the concern

Say you cannot give safety or structural advice

Point to the correct professional route (builder, electrician, fire service, warranty provider)

If relevant, reference the homeowner manual section on reporting defects

You must NOT guess or infer safety information from drawings, floor plans, or general documents.
If something is unclear or not explicitly stated, you MUST say you do not know.

Emergency rule:
If a user indicates immediate danger (smell of gas, burning smell, electrical arcing, sparking, major leak, structural movement), instruct them to immediately contact emergency services (999 or 112) or a licensed professional. Do not provide further guidance.

CRITICAL - GDPR PRIVACY PROTECTION (LEGAL REQUIREMENT):
- You MUST ONLY discuss information about the logged-in homeowner's own unit${userUnitDetails.address ? ` (${userUnitDetails.address})` : ''}
- NEVER provide any information about other residents' homes, units, or properties under any circumstances
- If asked about another unit, neighbour's home, or any other resident's property, respond with:
  "I'm afraid I can only provide information about your own home, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes."`;

      // SUGGESTED PILLS V2: Apply intent playbook enhancement when intent metadata is present (no documents case)
      if (activeIntentKey) {
        const intentPlaybook = getIntentPlaybook(activeIntentKey);
        if (intentPlaybook) {
          const intentPrompt = buildIntentSystemPrompt(intentPlaybook);
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${intentPrompt}\n\n---\n\n${systemMessage}`;
          console.log('[Chat] Intent playbook applied (no docs):', activeIntentKey);
        } else {
          // Always apply Global Safety Contract even without a specific playbook
          systemMessage = `${GLOBAL_SAFETY_CONTRACT}\n\n---\n\n${systemMessage}`;
          console.log('[Chat] Global Safety Contract applied (no docs, no playbook):', activeIntentKey);
        }
      }

      console.log('[Chat] No relevant documents found for this query');
      
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
            issueType: sessionMemory?.issue ?? undefined,
          },
        });
        console.log('[Chat] Escalation guidance prepared:', escalationGuidance.escalationTarget);
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
          question_preview: message.substring(0, 200), // Capture more context for training
          conversationDepth: conversationHistory.length + 1,
          escalationTarget: escalationGuidance?.escalationTarget,
        },
        sessionId: validatedUnitUid || conversationUserId,
        unitId: effectiveUnitUid,
      }).catch(() => {}); // Don't fail chat if analytics fails
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
      ? findDrawingForQuestion(effectiveUnitUid, await questionTopicPromise).catch(err => {
          console.error('[Chat] Error finding drawing:', err);
          return { found: false, drawing: null, explanation: '' };
        })
      : Promise.resolve({ found: false, drawing: null, explanation: '' });

    const [questionTopic, drawingResult] = await Promise.all([
      questionTopicPromise,
      drawingPromise
    ]);

    console.log('[Chat] Question topic:', questionTopic);
    
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
    
    // If question is ambiguous about internal vs external, offer clarification
    if (isAmbiguousSizeQuestion && effectiveUnitUid) {
      console.log('[Chat] Ambiguous size question detected - offering clarification');
      
      const clarificationResponse = "Would you like to see the internal floor plans (showing room layouts and dimensions) or the external elevations (showing the outside appearance of your home)?";
      
      // Save clarification interaction
      await persistMessageSafely({
        tenant_id: userTenantId,
        development_id: userDevelopmentId,
        unit_id: actualUnitId,
        require_unit_id: true,
        user_id: conversationUserId || null,
        unit_uid: effectiveUnitUid || null,
        user_message: message,
        ai_message: clarificationResponse,
        question_topic: 'clarification_needed',
        source: 'purchaser_portal',
        latency_ms: Date.now() - startTime,
        metadata: {
          clarificationType: 'drawing_type',
        },
        request_id: requestId,
      });
      
      return NextResponse.json({
        success: true,
        answer: clarificationResponse,
        source: 'clarification',
        clarification: {
          type: 'drawing_type',
          options: [
            { id: 'internal', label: 'Internal Floor Plans', description: 'Room layouts and dimensions' },
            { id: 'external', label: 'External Elevations', description: 'Outside appearance of your home' },
          ],
        },
      });
    }

    if (drawingResult.found && drawingResult.drawing) {
      drawing = drawingResult.drawing;
      drawingExplanation = drawingResult.explanation;
      console.log('[Chat] Found drawing:', drawing.fileName, 'Type:', drawing.drawingType);
      
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
        console.log('[Chat] Tracked drawing served:', drawing.fileName);
      } catch (trackErr) {
        console.error('[Chat] Failed to track drawing served:', trackErr);
      }
    }

    // DOCUMENT LINK REQUEST: Check if user is asking for a download link/preview
    let documentLink: ResolvedDocument | null = null;
    let documentLinkExplanation = '';
    
    const linkRequest = detectDocumentLinkRequest(message);
    if (linkRequest.isLinkRequest && effectiveUnitUid) {
      console.log('[Chat] Document link request detected, hint:', linkRequest.documentHint);
      
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
        console.log('[Chat] Found document for link:', documentLink.fileName);
        
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
          console.log('[Chat] Tracked document served:', documentLink.fileName);
        } catch (trackErr) {
          console.error('[Chat] Failed to track document served:', trackErr);
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
      console.log('[Chat] Floor plan link request detected');
      
      const floorPlanResult = await findFloorPlanDocuments(
        effectiveUnitUid,
        userSupabaseProjectId,
        userHouseTypeCode || undefined
      );
      
      if (floorPlanResult.found && floorPlanResult.attachments.length > 0) {
        const floorPlanAnswer = floorPlanResult.attachments.length === 1
          ? "Here's your floor plan. You can view or download it below."
          : `Here are your floor plans (${floorPlanResult.attachments.length} documents). You can view or download them below.`;
        
        console.log('[Chat] Returning', floorPlanResult.attachments.length, 'floor plan attachments');
        
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
    const isDimensionQuestion = questionTopic === 'room_sizes' ||
      /\b(dimension|measurement|square\s*(feet|metres?|meters?|m2|ft2?)|floor\s*area)\b/i.test(message) ||
      /\bwhat\s+size\s+(is|are)\s+(my|the)\s+(living\s*room|bedroom|kitchen|bathroom|utility|house|home|room)/i.test(message) ||
      /\bhow\s+(big|large)\s+(is|are)\s+(my|the)\s+(living\s*room|bedroom|kitchen|bathroom|utility|house|home|room)/i.test(message) ||
      /\b(living\s*room|bedroom|kitchen|bathroom|utility|room)\s+(size|dimensions?|measurements?|area)\b/i.test(message);

    // Extract the specific room being asked about
    const extractedRoom = isDimensionQuestion ? extractRoomNameFromQuestion(message) : null;

    const shouldOverrideForLiability = isDimensionQuestion && drawing && drawing.drawingType === 'room_sizes';
    const isDimensionQuestionWithNoDrawing = isDimensionQuestion && !drawing;

    // STEP 5: Generate Response with STREAMING
    console.log('[Chat] Generating streaming response with GPT-4o-mini...');
    
    // Build messages array with conversation history for context
    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemMessage },
    ];
    
    // Add recent conversation history so the AI understands follow-up questions
    if (conversationHistory.length > 0) {
      console.log('[Chat] Including', conversationHistory.length, 'previous exchanges in context');
      for (const exchange of conversationHistory) {
        chatMessages.push({ role: 'user', content: exchange.userMessage });
        chatMessages.push({ role: 'assistant', content: exchange.aiMessage });
      }
    }
    
    // Add the current user message
    chatMessages.push({ role: 'user', content: message });

    // Handle ALL dimension questions - look up from database AND attach floor plans
    if (isDimensionQuestion) {
      console.log('[Chat] Dimension question detected - looking up room dimensions and floor plans');
      console.log('[Chat] Extracted room:', extractedRoom);

      // Start both lookups in parallel for performance
      const [floorPlanResult, roomDimensionResult] = await Promise.all([
        findFloorPlanDocuments(
          effectiveUnitUid,
          userSupabaseProjectId,
          userHouseTypeCode || undefined
        ),
        // Look up room dimensions from database if we identified a room
        extractedRoom ? lookupRoomDimensions(
          getSupabaseClient(),
          userTenantId,
          userDevelopmentId,
          userHouseTypeCode || undefined,
          actualUnitId || undefined,
          extractedRoom.roomKey
        ) : Promise.resolve({ found: false } as RoomDimensionResult)
      ]);

      let dimensionAnswer: string;
      let floorPlanAttachments: FloorPlanAttachment[] = [];
      let answerSource = 'dimension_no_data';

      // Build response based on what we found
      if (roomDimensionResult.found && extractedRoom) {
        // We have actual room dimensions from the database!
        dimensionAnswer = formatRoomDimensionAnswer(roomDimensionResult, extractedRoom.roomName);
        answerSource = 'dimension_database';
        console.log('[Chat] Found room dimensions in database for', extractedRoom.roomKey);
      } else if (floorPlanResult.found && floorPlanResult.attachments.length > 0) {
        // No database dimensions but we have floor plans
        floorPlanAttachments = floorPlanResult.attachments;
        dimensionAnswer = "I've popped the floor plan below for you - that'll have the accurate room dimensions.\n\nCheck the room labels on the plans for the exact measurements you need.";
        answerSource = 'dimension_floor_plan_fallback';
        console.log('[Chat] Using floor plan fallback for dimension question');
      } else {
        // No dimensions and no floor plans
        dimensionAnswer = "I don't have the room dimensions stored yet, and I couldn't find floor plan documents to show you. I'd recommend contacting your developer or management company for precise room measurements, or checking your original floor plan documentation.";
        console.log('[Chat] No room dimensions or floor plans available');
      }

      // Always try to attach floor plans if available (even if we have dimensions)
      if (floorPlanResult.found && floorPlanResult.attachments.length > 0) {
        floorPlanAttachments = floorPlanResult.attachments;
        console.log('[Chat] Attaching', floorPlanAttachments.length, 'floor plans to response');
      }

      // Also include drawing if available
      const drawingAttachment = drawing ? {
        fileName: drawing.fileName,
        drawingType: drawing.drawingType,
        drawingDescription: drawing.drawingDescription,
        houseTypeCode: drawing.houseTypeCode,
        previewUrl: drawing.signedUrl,
        downloadUrl: drawing.downloadUrl,
        explanation: drawingExplanation,
      } : undefined;

      // Save to database
      await persistMessageSafely({
        tenant_id: userTenantId,
        development_id: userDevelopmentId,
        unit_id: actualUnitId,
        require_unit_id: true,
        user_id: conversationUserId || null,
        unit_uid: validatedUnitUid || null,
        user_message: message,
        ai_message: dimensionAnswer,
        question_topic: questionTopic,
        source: 'purchaser_portal',
        latency_ms: Date.now() - startTime,
        metadata: {
          userId: userId || null,
          chunksUsed: chunks?.length || 0,
          model: 'gpt-4o-mini',
          dimensionQuestion: true,
          roomKey: extractedRoom?.roomKey,
          foundDimensions: roomDimensionResult.found,
          foundFloorPlans: floorPlanAttachments.length > 0,
        },
        request_id: requestId,
      });

      return NextResponse.json({
        success: true,
        answer: dimensionAnswer,
        source: answerSource,
        chunksUsed: chunks?.length || 0,
        drawing: drawingAttachment,
        attachments: floorPlanAttachments.length > 0 ? floorPlanAttachments.map(fp => ({
          id: fp.id,
          title: fp.title,
          fileName: fp.fileName,
          previewUrl: fp.signedUrl,
          downloadUrl: fp.downloadUrl,
          discipline: fp.discipline,
          docType: fp.docType,
          houseTypeCode: fp.houseTypeCode,
        })) : undefined,
      });
    }

    // TEST MODE: Return JSON response instead of streaming for test harness
    if (testMode) {
      console.log('[Chat] TEST MODE: Generating non-streaming response...');
      const completion = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: 0.3,
        max_tokens: 800,
        stream: false,
      });
      
      let fullAnswer = cleanMarkdownFormatting(completion.choices[0]?.message?.content || '');
      const latencyMs = Date.now() - startTime;
      console.log('[Chat] TEST MODE: Response generated. Length:', fullAnswer.length, 'Latency:', latencyMs, 'ms');
      
      // AMENITY HALLUCINATION CHECK: Block fabricated venue names, travel times, distances
      // CRITICAL: If we're in the LLM path, we do NOT have grounded POI data - never bypass validation
      // The POI path returns early via formatPOIResponse, so if we're here, we don't have real venue data
      const hasAmenityContext = false; // LLM path never has grounded POI context
      const hallucinationCheck = detectAmenityHallucinations(fullAnswer, hasAmenityContext);
      
      if (hallucinationCheck.hasHallucination) {
        console.log('[Chat] AMENITY HALLUCINATION BLOCKED:', hallucinationCheck.detectedIssues);
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
        } catch (logError) {
          console.error('[Chat] Failed to log hallucination block:', logError);
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
            console.log('[Chat] Escalation guidance appended for:', escalationGuidance.escalationTarget);
          } else {
            console.log('[Chat] Escalation guidance blocked (placeholder tokens or unknown target)');
          }
        } else {
          console.log('[Chat] Escalation skipped for non-actionable intent:', effectiveIntent);
        }
      }
      
      // NEXT BEST ACTION: Append capability-safe follow-up suggestions
      let nbaDebugInfo: NextBestActionResult | null = null;
      let nbaSuggestionUsed: string | null = null;
      
      if (capabilityContext && isNextBestActionEnabled()) {
        const effectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
        const nbaResult = appendNextBestAction(fullAnswer, effectiveIntent, responseSource, capabilityContext);
        fullAnswer = nbaResult.response;
        nbaSuggestionUsed = nbaResult.suggestionUsed;
        nbaDebugInfo = nbaResult.debugInfo;
        
        if (nbaSuggestionUsed) {
          console.log('[Chat] Next Best Action appended:', nbaSuggestionUsed.substring(0, 50) + '...');
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
        console.log('[Chat] Tone guardrails applied');
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
          citations: chunks?.slice(0, 3).map((c: any) => c.metadata?.file_name || 'document'),
        };
        
        firewallResult = enforceGrounding(firewallInput);
        
        if (firewallResult.modified) {
          console.log('[Chat] Hallucination firewall modified response:', firewallResult.violationType);
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
      
      return NextResponse.json({
        success: true,
        answer: fullAnswer,
        source: responseSource,
        chunksUsed: chunks?.length || 0,
        safetyIntercept: false,
      });
    }

    // Create streaming response
    const stream = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
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
          const isDocumentRelevantToTopic = (fileName: string, chunk: any, topic: string | null): boolean => {
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
          
          const metadata = {
            type: 'metadata',
            source: chunks && chunks.length > 0 ? 'semantic_search' : 'no_documents',
            chunksUsed: chunks?.length || 0,
            sources: sourceDocuments,
            drawing: drawing ? {
              fileName: drawing.fileName,
              drawingType: drawing.drawingType,
              drawingDescription: drawing.drawingDescription,
              houseTypeCode: drawing.houseTypeCode,
              previewUrl: drawing.signedUrl,
              downloadUrl: drawing.downloadUrl,
              explanation: drawingExplanation,
            } : null,
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
                console.log('[Chat] Escalation guidance streamed for:', escalationGuidance.escalationTarget);
              } else {
                console.log('[Chat] Escalation guidance blocked in stream (placeholder tokens or unknown target)');
              }
            } else {
              console.log('[Chat] Escalation skipped in stream for non-actionable intent:', streamEffectiveIntent);
            }
          }
          
          // NEXT BEST ACTION: Append capability-safe follow-up suggestions to streaming response
          let streamNbaSuggestion: string | null = null;
          
          if (capabilityContext && isNextBestActionEnabled()) {
            const streamEffectiveIntent = intentClassification?.intent || detectIntentFromMessage(message) || 'general';
            const streamNbaResult = appendNextBestAction('', streamEffectiveIntent, streamResponseSource, capabilityContext);
            
            if (streamNbaResult.suggestionUsed) {
              streamNbaSuggestion = streamNbaResult.suggestionUsed;
              const nbaContent = '\n\n' + streamNbaSuggestion;
              fullAnswer += nbaContent;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: nbaContent })}\n\n`));
              console.log('[Chat] Next Best Action streamed:', streamNbaSuggestion.substring(0, 50) + '...');
            }
          }
          
          // TONE GUARDRAILS: Add source hint at end of streaming response
          if (isToneGuardrailsEnabled() && streamResponseSource === 'semantic_search') {
            const sourceHintContent = '\n\nSource: Your home documentation' + (developmentName ? ` for ${developmentName}` : '');
            fullAnswer += sourceHintContent;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: sourceHintContent })}\n\n`));
          }
          
          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();

          // Save to database after streaming completes
          const latencyMs = Date.now() - startTime;
          console.log('[Chat] Streaming complete. Answer length:', fullAnswer.length, 'Latency:', latencyMs, 'ms');
          
          // TONE GUARDRAILS: Apply final cleanup to complete response for storage
          // Uses processStreamedResponse to apply phrase replacements, em-dash removal, and formatting
          if (isToneGuardrailsEnabled()) {
            fullAnswer = processStreamedResponse(fullAnswer, streamToneInput);
            console.log('[Chat] Tone guardrails finalized for streamed response storage');
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
              citations: chunks?.slice(0, 3).map((c: any) => c.metadata?.file_name || 'document'),
            };
            
            streamFirewallResult = enforceGrounding(streamFirewallInput);
            
            if (streamFirewallResult.modified) {
              console.log('[Chat] Hallucination firewall detected violation in streamed response:', streamFirewallResult.violationType);
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
              } catch (logError) {
                console.error('[Chat] Failed to log firewall violation:', logError);
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
            console.log('[Chat] STREAMING HALLUCINATION DETECTED (already sent to client):', streamHallucinationCheck.detectedIssues);
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
            } catch (logError) {
              console.error('[Chat] Failed to log streaming hallucination:', logError);
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
          console.log('[Chat] Message saved to database');
        } catch (error) {
          console.error('[Chat] Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Streaming failed' })}\n\n`));
          controller.close();
        }
      },
    });

    console.log('============================================================\n');

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
