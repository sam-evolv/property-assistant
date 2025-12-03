import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { normalizeToCanonicalRoomName } from './normalize-room-name';

export interface CanonicalRoomDimension {
  room_name: string;
  room_key: string;
  level?: string;
  length_m?: number;
  width_m?: number;
  area_m2?: number;
  source_document_id?: string;
  extraction_confidence: number;
  source: 'vision_floorplan' | 'intelligence_profile' | 'house_types' | 'manual';
}

export interface DimensionLookupResult {
  found: boolean;
  room?: CanonicalRoomDimension;
  allRooms?: CanonicalRoomDimension[];
  houseTypeCode?: string;
  reason?: string;
}

const ROOM_NAME_MAPPINGS: Record<string, string[]> = {
  'toilet': ['toilet', 'wc', 'downstairs toilet', 'ground floor toilet', 'cloakroom', 'guest toilet', 'powder room'],
  'living_room': ['living room', 'sitting room', 'lounge', 'front room', 'living area', 'reception room'],
  'kitchen': ['kitchen'],
  'kitchen_dining': ['kitchen dining', 'kitchen/dining', 'open plan kitchen', 'kitchen and dining'],
  'dining': ['dining room', 'dining area', 'dining'],
  'utility': ['utility', 'utility room', 'laundry', 'storage'],
  'entrance_hall': ['hall', 'entrance', 'hallway', 'entrance hall', 'front hall', 'foyer'],
  'bedroom_1': ['bedroom 1', 'bedroom one', 'main bedroom', 'master bedroom', 'primary bedroom'],
  'bedroom_2': ['bedroom 2', 'bedroom two', 'second bedroom'],
  'bedroom_3': ['bedroom 3', 'bedroom three', 'third bedroom'],
  'bedroom_4': ['bedroom 4', 'bedroom four', 'fourth bedroom'],
  'ensuite': ['ensuite', 'en-suite', 'en suite', 'master bathroom', 'master ensuite', 'ensuite bathroom'],
  'bathroom': ['bathroom', 'main bathroom', 'family bathroom', 'upstairs bathroom'],
  'landing': ['landing', 'upstairs landing', 'upper landing', 'stairs landing'],
  'garage': ['garage', 'car port', 'carport'],
  'study': ['study', 'office', 'home office', 'box room'],
  'hotpress': ['hotpress', 'hot press', 'airing cupboard', 'boiler room'],
};

const DIMENSION_QUESTION_PATTERNS = [
  /(?:what|how\s+big|what\s+size|what\s+are\s+the\s+dimension|tell\s+me\s+the\s+size|what\s+is\s+the\s+size|how\s+large)/i,
  /(?:floor\s+area|room\s+(?:size|dimension)|sqm|m²|square\s+met(?:er|re)s?\s+(?:of|for|in))/i,
  /(?:how\s+(?:big|large|wide|long)\s+is\s+(?:the|my))/i,
  /(?:size\s+(?:of|is)\s+(?:the|my))/i,
  /(?:dimension(?:s)?\s+(?:of|for))/i,
];

const DIMENSION_EXCLUSION_PATTERNS = [
  /(?:ber|energy)\s+rating/i,
  /(?:heating|cooling|ventilation)\s+system/i,
  /(?:warranty|guarantee)/i,
  /(?:when|who|what\s+company|supplier)/i,
];

const DIMENSION_REGEX = /(\d+(?:\.\d+)?)\s*(?:m\b|m²|meters?|metres?|square\s*met(?:er|re)s?)/gi;
const DIMENSION_CROSS_REGEX = /(\d+(?:\.\d+)?)\s*(?:m\b|meters?|metres?)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:m\b|meters?|metres?)?/gi;

export function isDimensionQuestion(question: string): boolean {
  const questionLower = question.toLowerCase();
  
  if (DIMENSION_EXCLUSION_PATTERNS.some(pattern => pattern.test(questionLower))) {
    return false;
  }
  
  const hasRoomReference = Object.values(ROOM_NAME_MAPPINGS).some(variants =>
    variants.some(v => questionLower.includes(v))
  );
  
  const hasDimensionKeyword = DIMENSION_QUESTION_PATTERNS.some(pattern => 
    pattern.test(questionLower)
  );
  
  return hasRoomReference && hasDimensionKeyword;
}

export function extractRoomNameFromQuestion(question: string): string | null {
  const questionLower = question.toLowerCase();
  
  const orderedKeys = [
    'kitchen_dining',
    'bedroom_1', 'bedroom_2', 'bedroom_3', 'bedroom_4',
    'living_room', 'entrance_hall', 'ensuite',
    'toilet', 'kitchen', 'dining', 'utility', 'bathroom',
    'landing', 'garage', 'study', 'hotpress',
  ];
  
  for (const roomKey of orderedKeys) {
    const variants = ROOM_NAME_MAPPINGS[roomKey];
    if (!variants) continue;
    
    for (const variant of variants) {
      if (questionLower.includes(variant)) {
        return roomKey;
      }
    }
  }
  
  return null;
}

export function normalizeRoomKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

function formatRoomNameForDisplay(key: string): string {
  const displayNames: Record<string, string> = {
    'toilet': 'toilet',
    'living_room': 'living room',
    'kitchen': 'kitchen',
    'kitchen_dining': 'kitchen/dining area',
    'dining': 'dining room',
    'utility': 'utility room',
    'entrance_hall': 'entrance hall',
    'bedroom_1': 'main bedroom',
    'bedroom_2': 'second bedroom',
    'bedroom_3': 'third bedroom',
    'bedroom_4': 'fourth bedroom',
    'ensuite': 'ensuite bathroom',
    'bathroom': 'bathroom',
    'landing': 'landing',
    'garage': 'garage',
    'study': 'study',
    'hotpress': 'hot press',
  };
  
  return displayNames[key] || key.replace(/_/g, ' ');
}

export async function getCanonicalRoomDimension(
  tenantId: string,
  developmentId: string,
  houseTypeCode: string,
  roomKey: string
): Promise<DimensionLookupResult> {
  const canonicalRoomName = normalizeToCanonicalRoomName(roomKey);
  
  console.log(`\n🔍 DIMENSION GUARDRAIL: Looking up "${roomKey}" for ${houseTypeCode}`);
  console.log(`   📌 Canonical room name: ${canonicalRoomName}`);
  
  const visionResult = await db.execute<{
    room_name: string;
    canonical_room_name: string;
    level: string | null;
    length_m: number | null;
    width_m: number | null;
    area_m2: number | null;
    confidence: number;
    source: string;
  }>(sql`
    SELECT room_name, canonical_room_name, level, length_m, width_m, area_m2, confidence, source
    FROM unit_room_dimensions
    WHERE tenant_id = ${tenantId}::uuid
      AND unit_type_code = ${houseTypeCode}
      AND canonical_room_name = ${canonicalRoomName}
    ORDER BY confidence DESC, updated_at DESC
    LIMIT 1
  `);
  
  if (visionResult.rows && visionResult.rows.length > 0) {
    const room = visionResult.rows[0];
    console.log(`   ✅ Found in unit_room_dimensions (Vision): ${room.area_m2} m²`);
    
    return {
      found: true,
      room: {
        room_name: formatRoomNameForDisplay(roomKey),
        room_key: roomKey,
        level: room.level || undefined,
        length_m: room.length_m || undefined,
        width_m: room.width_m || undefined,
        area_m2: room.area_m2 || undefined,
        extraction_confidence: room.confidence || 0.9,
        source: 'vision_floorplan',
      },
      houseTypeCode,
    };
  }
  
  const profileResult = await db.execute<{
    rooms: Record<string, any>;
    source_document_ids: string[];
    quality_score: number;
  }>(sql`
    SELECT rooms, source_document_ids, quality_score
    FROM unit_intelligence_profiles
    WHERE tenant_id = ${tenantId}::uuid
      AND development_id = ${developmentId}::uuid
      AND house_type_code = ${houseTypeCode}
      AND is_current = true
    LIMIT 1
  `);
  
  if (profileResult.rows && profileResult.rows.length > 0) {
    const profile = profileResult.rows[0];
    const rooms = profile.rooms || {};
    
    if (rooms[roomKey] && (rooms[roomKey].length_m || rooms[roomKey].area_sqm)) {
      const room = rooms[roomKey];
      console.log(`   ✅ Found in intelligence profile: ${room.length_m}m × ${room.width_m}m`);
      
      return {
        found: true,
        room: {
          room_name: formatRoomNameForDisplay(roomKey),
          room_key: roomKey,
          length_m: room.length_m,
          width_m: room.width_m,
          area_m2: room.area_sqm || (room.length_m && room.width_m ? room.length_m * room.width_m : undefined),
          source_document_id: profile.source_document_ids?.[0],
          extraction_confidence: room.confidence || 0.8,
          source: 'intelligence_profile',
        },
        houseTypeCode,
      };
    }
    
    const normalizedKey = normalizeRoomKey(roomKey);
    for (const [key, value] of Object.entries(rooms)) {
      if (normalizeRoomKey(key) === normalizedKey && value && (value.length_m || value.area_sqm)) {
        console.log(`   ✅ Found in profile (fuzzy match): ${value.length_m}m × ${value.width_m}m`);
        return {
          found: true,
          room: {
            room_name: formatRoomNameForDisplay(key),
            room_key: key,
            length_m: value.length_m,
            width_m: value.width_m,
            area_m2: value.area_sqm || (value.length_m && value.width_m ? value.length_m * value.width_m : undefined),
            source_document_id: profile.source_document_ids?.[0],
            extraction_confidence: value.confidence || 0.8,
            source: 'intelligence_profile',
          },
          houseTypeCode,
        };
      }
    }
  }
  
  const houseTypeResult = await db.execute<{
    room_dimensions: Record<string, any>;
    total_floor_area_sqm: string;
  }>(sql`
    SELECT room_dimensions, total_floor_area_sqm
    FROM house_types
    WHERE development_id = ${developmentId}::uuid
      AND house_type_code = ${houseTypeCode}
    LIMIT 1
  `);
  
  if (houseTypeResult.rows && houseTypeResult.rows.length > 0) {
    const ht = houseTypeResult.rows[0];
    const roomDims = ht.room_dimensions || {};
    
    if (roomDims[roomKey] && (roomDims[roomKey].length_m || roomDims[roomKey].area_sqm)) {
      const room = roomDims[roomKey];
      console.log(`   ✅ Found in house_types: ${room.length_m}m × ${room.width_m}m`);
      
      return {
        found: true,
        room: {
          room_name: formatRoomNameForDisplay(roomKey),
          room_key: roomKey,
          length_m: room.length_m,
          width_m: room.width_m,
          area_m2: room.area_sqm || (room.length_m && room.width_m ? room.length_m * room.width_m : undefined),
          extraction_confidence: 1.0,
          source: 'house_types',
        },
        houseTypeCode,
      };
    }
    
    const normalizedKey = normalizeRoomKey(roomKey);
    for (const [key, value] of Object.entries(roomDims)) {
      if (normalizeRoomKey(key) === normalizedKey && value && (value.length_m || value.area_sqm)) {
        console.log(`   ✅ Found in house_types (fuzzy match): ${value.length_m}m × ${value.width_m}m`);
        return {
          found: true,
          room: {
            room_name: formatRoomNameForDisplay(key),
            room_key: key,
            length_m: value.length_m,
            width_m: value.width_m,
            area_m2: value.area_sqm || (value.length_m && value.width_m ? value.length_m * value.width_m : undefined),
            extraction_confidence: 1.0,
            source: 'house_types',
          },
          houseTypeCode,
        };
      }
    }
  }
  
  console.log(`   ❌ No dimension data found for "${roomKey}"`);
  return {
    found: false,
    reason: `No verified dimension data found for "${formatRoomNameForDisplay(roomKey)}" in ${houseTypeCode}`,
    houseTypeCode,
  };
}

export async function getAllCanonicalRoomDimensions(
  tenantId: string,
  developmentId: string,
  houseTypeCode: string
): Promise<CanonicalRoomDimension[]> {
  const rooms: CanonicalRoomDimension[] = [];
  
  const profileResult = await db.execute<{
    rooms: Record<string, any>;
    source_document_ids: string[];
  }>(sql`
    SELECT rooms, source_document_ids
    FROM unit_intelligence_profiles
    WHERE tenant_id = ${tenantId}::uuid
      AND development_id = ${developmentId}::uuid
      AND house_type_code = ${houseTypeCode}
      AND is_current = true
    LIMIT 1
  `);
  
  if (profileResult.rows && profileResult.rows.length > 0) {
    const profile = profileResult.rows[0];
    const profileRooms = profile.rooms || {};
    
    for (const [key, value] of Object.entries(profileRooms)) {
      if (value && (value.length_m || value.area_sqm)) {
        rooms.push({
          room_name: formatRoomNameForDisplay(key),
          room_key: key,
          length_m: value.length_m,
          width_m: value.width_m,
          area_m2: value.area_sqm,
          source_document_id: profile.source_document_ids?.[0],
          extraction_confidence: value.confidence || 0.8,
          source: 'intelligence_profile',
        });
      }
    }
  }
  
  const houseTypeResult = await db.execute<{
    room_dimensions: Record<string, any>;
  }>(sql`
    SELECT room_dimensions
    FROM house_types
    WHERE development_id = ${developmentId}::uuid
      AND house_type_code = ${houseTypeCode}
    LIMIT 1
  `);
  
  if (houseTypeResult.rows && houseTypeResult.rows.length > 0) {
    const ht = houseTypeResult.rows[0];
    const roomDims = ht.room_dimensions || {};
    
    for (const [key, value] of Object.entries(roomDims)) {
      if (value && (value.length_m || value.area_sqm)) {
        const existingIdx = rooms.findIndex(r => r.room_key === key);
        if (existingIdx === -1) {
          rooms.push({
            room_name: formatRoomNameForDisplay(key),
            room_key: key,
            length_m: value.length_m,
            width_m: value.width_m,
            area_m2: value.area_sqm,
            extraction_confidence: 1.0,
            source: 'house_types',
          });
        }
      }
    }
  }
  
  return rooms;
}

export function formatGroundedDimensionAnswer(
  room: CanonicalRoomDimension,
  houseTypeCode: string,
  address?: string
): string {
  const parts: string[] = [];
  
  if (room.length_m && room.width_m) {
    parts.push(`Your ${room.room_name} measures approximately ${room.length_m.toFixed(1)}m × ${room.width_m.toFixed(1)}m`);
    
    const area = room.area_m2 || (room.length_m * room.width_m);
    parts.push(`giving a floor area of ${area.toFixed(1)} m²`);
  } else if (room.area_m2) {
    parts.push(`Your ${room.room_name} has a floor area of approximately ${room.area_m2.toFixed(1)} m²`);
  }
  
  let answer = parts.join(', ') + '.';
  
  const sourceDesc = room.source === 'intelligence_profile' 
    ? 'extracted from your floor plans' 
    : 'from the specifications';
  
  answer += ` This is based on data ${sourceDesc} for your ${houseTypeCode} house type`;
  
  if (address) {
    answer += ` at ${address}`;
  }
  
  answer += '.';
  
  return answer;
}

export const SAFE_DIMENSION_FALLBACK = 
  "I don't have verified room dimensions for that space in your current documents, " +
  "so I can't give you a precise size. Would you like me to check with your developer " +
  "for the exact measurements?";

export const SAFE_DIMENSION_FALLBACK_SPECIFIC = (roomName: string, houseTypeCode: string) =>
  `I don't have a precise numeric size for the ${roomName} in your ${houseTypeCode} house type ` +
  `in the current drawings. I can check with your developer if you like, or confirm once ` +
  `updated plans are available.`;

export function containsFabricatedDimensions(
  text: string,
  wasCanonicalLookupSuccessful: boolean
): boolean {
  if (wasCanonicalLookupSuccessful) {
    return false;
  }
  
  const dimensionMatches = text.match(DIMENSION_REGEX);
  if (dimensionMatches && dimensionMatches.length >= 2) {
    console.log(`⚠️  DIMENSION VALIDATOR: Detected potential fabrication - ${dimensionMatches.length} dimension values found`);
    return true;
  }
  
  const crossMatches = text.match(DIMENSION_CROSS_REGEX);
  if (crossMatches) {
    console.log(`⚠️  DIMENSION VALIDATOR: Detected potential fabrication - "X by Y" pattern found`);
    return true;
  }
  
  const areaPatterns = /approximately\s+\d+(?:\.\d+)?\s*m²|floor\s+area\s+of\s+(?:about\s+)?\d+(?:\.\d+)?/gi;
  if (areaPatterns.test(text)) {
    console.log(`⚠️  DIMENSION VALIDATOR: Detected potential fabrication - area measurement found`);
    return true;
  }
  
  return false;
}

export interface DimensionGuardrailResult {
  shouldIntercept: boolean;
  groundedAnswer?: string;
  roomKey?: string;
  lookupSuccessful: boolean;
}

export async function applyDimensionGuardrail(
  question: string,
  tenantId: string,
  developmentId: string,
  houseTypeCode: string | undefined,
  address?: string
): Promise<DimensionGuardrailResult> {
  if (!isDimensionQuestion(question)) {
    return { shouldIntercept: false, lookupSuccessful: false };
  }
  
  const roomKey = extractRoomNameFromQuestion(question);
  
  if (!roomKey) {
    return { shouldIntercept: false, lookupSuccessful: false };
  }
  
  if (!houseTypeCode) {
    console.log('⚠️  DIMENSION GUARDRAIL: No house type code - cannot lookup dimensions');
    return { 
      shouldIntercept: true, 
      groundedAnswer: SAFE_DIMENSION_FALLBACK,
      roomKey,
      lookupSuccessful: false,
    };
  }
  
  const lookup = await getCanonicalRoomDimension(tenantId, developmentId, houseTypeCode, roomKey);
  
  if (lookup.found && lookup.room) {
    const confidence = lookup.room.extraction_confidence;
    
    if (confidence >= 0.75 && (lookup.room.length_m || lookup.room.area_m2)) {
      return {
        shouldIntercept: true,
        groundedAnswer: formatGroundedDimensionAnswer(lookup.room, houseTypeCode, address),
        roomKey,
        lookupSuccessful: true,
      };
    } else {
      console.log(`⚠️  DIMENSION GUARDRAIL: Low confidence (${confidence}) - using safe fallback`);
      return {
        shouldIntercept: true,
        groundedAnswer: SAFE_DIMENSION_FALLBACK_SPECIFIC(lookup.room.room_name, houseTypeCode),
        roomKey,
        lookupSuccessful: false,
      };
    }
  }
  
  return {
    shouldIntercept: true,
    groundedAnswer: SAFE_DIMENSION_FALLBACK_SPECIFIC(formatRoomNameForDisplay(roomKey), houseTypeCode),
    roomKey,
    lookupSuccessful: false,
  };
}

export function validateLLMResponseForDimensions(
  llmResponse: string,
  originalQuestion: string,
  wasCanonicalLookupSuccessful: boolean
): { isValid: boolean; sanitizedResponse?: string } {
  if (!isDimensionQuestion(originalQuestion)) {
    return { isValid: true };
  }
  
  if (wasCanonicalLookupSuccessful) {
    return { isValid: true };
  }
  
  if (containsFabricatedDimensions(llmResponse, wasCanonicalLookupSuccessful)) {
    console.log('❌ DIMENSION VALIDATOR: Discarding LLM response with fabricated dimensions');
    return {
      isValid: false,
      sanitizedResponse: "I don't have exact room dimensions for that space in your current documents, so I can't give you a precise size. Would you like me to check with your developer for the exact measurements?",
    };
  }
  
  return { isValid: true };
}
