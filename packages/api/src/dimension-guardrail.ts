import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { normalizeToCanonicalRoomName } from './normalize-room-name';

export interface CanonicalRoomDimension {
  room_name: string;
  room_key: string;
  floor?: string;
  length_m?: number;
  width_m?: number;
  area_sqm?: number;
  ceiling_height_m?: number;
  source_document_id?: string;
  extraction_confidence: number;
  verified: boolean;
  unit_id?: string;
  source: 'verified_unit' | 'verified_house_type' | 'vision_floorplan' | 'intelligence_profile' | 'house_types' | 'manual';
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
  roomKey: string,
  unitId?: string
): Promise<DimensionLookupResult> {
  const canonicalRoomName = normalizeToCanonicalRoomName(roomKey);
  
  console.log(`\n🔍 DIMENSION GUARDRAIL: Looking up "${roomKey}" for ${houseTypeCode}`);
  console.log(`   📌 Canonical room name: ${canonicalRoomName}`);
  console.log(`   📌 Unit ID: ${unitId || 'not specified'}`);
  
  if (unitId) {
    const verifiedUnitResult = await db.execute<{
      room_name: string;
      room_key: string;
      floor: string | null;
      length_m: number | null;
      width_m: number | null;
      area_sqm: string | null;
      ceiling_height_m: string | null;
      confidence: number;
      verified: boolean;
      unit_id: string;
    }>(sql`
      SELECT room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, confidence, verified, unit_id
      FROM unit_room_dimensions
      WHERE tenant_id = ${tenantId}::uuid
        AND unit_id = ${unitId}::uuid
        AND room_key = ${roomKey}
        AND verified = true
      ORDER BY confidence DESC, updated_at DESC
      LIMIT 1
    `);
    
    if (verifiedUnitResult.rows && verifiedUnitResult.rows.length > 0) {
      const room = verifiedUnitResult.rows[0];
      console.log(`   ✅ PRIORITY 1: Found verified unit-level dimension: ${room.area_sqm} m²`);
      
      return {
        found: true,
        room: {
          room_name: formatRoomNameForDisplay(roomKey),
          room_key: roomKey,
          floor: room.floor || undefined,
          length_m: room.length_m || undefined,
          width_m: room.width_m || undefined,
          area_sqm: room.area_sqm ? parseFloat(room.area_sqm) : undefined,
          ceiling_height_m: room.ceiling_height_m ? parseFloat(room.ceiling_height_m) : undefined,
          extraction_confidence: room.confidence || 0.95,
          verified: true,
          unit_id: room.unit_id,
          source: 'verified_unit',
        },
        houseTypeCode,
      };
    }
  }
  
  const verifiedHouseTypeResult = await db.execute<{
    room_name: string;
    room_key: string;
    floor: string | null;
    length_m: number | null;
    width_m: number | null;
    area_sqm: string | null;
    ceiling_height_m: string | null;
    confidence: number;
    verified: boolean;
  }>(sql`
    SELECT room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, confidence, verified
    FROM unit_room_dimensions
    WHERE tenant_id = ${tenantId}::uuid
      AND unit_type_code = ${houseTypeCode}
      AND room_key = ${roomKey}
      AND verified = true
      AND unit_id IS NULL
    ORDER BY confidence DESC, updated_at DESC
    LIMIT 1
  `);
  
  if (verifiedHouseTypeResult.rows && verifiedHouseTypeResult.rows.length > 0) {
    const room = verifiedHouseTypeResult.rows[0];
    console.log(`   ✅ PRIORITY 2: Found verified house-type-level dimension: ${room.area_sqm} m²`);
    
    return {
      found: true,
      room: {
        room_name: formatRoomNameForDisplay(roomKey),
        room_key: roomKey,
        floor: room.floor || undefined,
        length_m: room.length_m || undefined,
        width_m: room.width_m || undefined,
        area_sqm: room.area_sqm ? parseFloat(room.area_sqm) : undefined,
        ceiling_height_m: room.ceiling_height_m ? parseFloat(room.ceiling_height_m) : undefined,
        extraction_confidence: room.confidence || 0.95,
        verified: true,
        source: 'verified_house_type',
      },
      houseTypeCode,
    };
  }
  
  const unverifiedVisionResult = await db.execute<{
    room_name: string;
    room_key: string;
    floor: string | null;
    length_m: number | null;
    width_m: number | null;
    area_sqm: string | null;
    ceiling_height_m: string | null;
    confidence: number;
    verified: boolean;
    unit_id: string | null;
  }>(sql`
    SELECT room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, confidence, verified, unit_id
    FROM unit_room_dimensions
    WHERE tenant_id = ${tenantId}::uuid
      AND unit_type_code = ${houseTypeCode}
      AND room_key = ${roomKey}
      AND verified = false
    ORDER BY confidence DESC, updated_at DESC
    LIMIT 1
  `);
  
  if (unverifiedVisionResult.rows && unverifiedVisionResult.rows.length > 0) {
    const room = unverifiedVisionResult.rows[0];
    console.log(`   ⚠️ PRIORITY 3: Found unverified vision extraction: ${room.area_sqm} m² (needs verification)`);
    
    return {
      found: true,
      room: {
        room_name: formatRoomNameForDisplay(roomKey),
        room_key: roomKey,
        floor: room.floor || undefined,
        length_m: room.length_m || undefined,
        width_m: room.width_m || undefined,
        area_sqm: room.area_sqm ? parseFloat(room.area_sqm) : undefined,
        ceiling_height_m: room.ceiling_height_m ? parseFloat(room.ceiling_height_m) : undefined,
        extraction_confidence: room.confidence || 0.7,
        verified: false,
        unit_id: room.unit_id || undefined,
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
      console.log(`   ⚠️ PRIORITY 4: Found in intelligence profile: ${room.length_m}m × ${room.width_m}m`);
      
      return {
        found: true,
        room: {
          room_name: formatRoomNameForDisplay(roomKey),
          room_key: roomKey,
          length_m: room.length_m,
          width_m: room.width_m,
          area_sqm: room.area_sqm || (room.length_m && room.width_m ? room.length_m * room.width_m : undefined),
          source_document_id: profile.source_document_ids?.[0],
          extraction_confidence: room.confidence || 0.8,
          verified: false,
          source: 'intelligence_profile',
        },
        houseTypeCode,
      };
    }
    
    const normalizedKey = normalizeRoomKey(roomKey);
    for (const [key, value] of Object.entries(rooms)) {
      if (normalizeRoomKey(key) === normalizedKey && value && (value.length_m || value.area_sqm)) {
        console.log(`   ⚠️ PRIORITY 4: Found in profile (fuzzy match): ${value.length_m}m × ${value.width_m}m`);
        return {
          found: true,
          room: {
            room_name: formatRoomNameForDisplay(key),
            room_key: key,
            length_m: value.length_m,
            width_m: value.width_m,
            area_sqm: value.area_sqm || (value.length_m && value.width_m ? value.length_m * value.width_m : undefined),
            source_document_id: profile.source_document_ids?.[0],
            extraction_confidence: value.confidence || 0.8,
            verified: false,
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
      console.log(`   ⚠️ PRIORITY 5: Found in house_types: ${room.length_m}m × ${room.width_m}m`);
      
      return {
        found: true,
        room: {
          room_name: formatRoomNameForDisplay(roomKey),
          room_key: roomKey,
          length_m: room.length_m,
          width_m: room.width_m,
          area_sqm: room.area_sqm || (room.length_m && room.width_m ? room.length_m * room.width_m : undefined),
          extraction_confidence: 1.0,
          verified: false,
          source: 'house_types',
        },
        houseTypeCode,
      };
    }
    
    const normalizedKey = normalizeRoomKey(roomKey);
    for (const [key, value] of Object.entries(roomDims)) {
      if (normalizeRoomKey(key) === normalizedKey && value && (value.length_m || value.area_sqm)) {
        console.log(`   ⚠️ PRIORITY 5: Found in house_types (fuzzy match): ${value.length_m}m × ${value.width_m}m`);
        return {
          found: true,
          room: {
            room_name: formatRoomNameForDisplay(key),
            room_key: key,
            length_m: value.length_m,
            width_m: value.width_m,
            area_sqm: value.area_sqm || (value.length_m && value.width_m ? value.length_m * value.width_m : undefined),
            extraction_confidence: 1.0,
            verified: false,
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
  houseTypeCode: string,
  unitId?: string
): Promise<CanonicalRoomDimension[]> {
  const rooms: Map<string, CanonicalRoomDimension> = new Map();
  
  if (unitId) {
    const verifiedUnitRooms = await db.execute<{
      room_name: string;
      room_key: string;
      floor: string | null;
      length_m: number | null;
      width_m: number | null;
      area_sqm: string | null;
      ceiling_height_m: string | null;
      confidence: number;
      verified: boolean;
      unit_id: string;
    }>(sql`
      SELECT room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, confidence, verified, unit_id
      FROM unit_room_dimensions
      WHERE tenant_id = ${tenantId}::uuid
        AND unit_id = ${unitId}::uuid
        AND verified = true
      ORDER BY confidence DESC
    `);
    
    for (const row of verifiedUnitRooms.rows || []) {
      rooms.set(row.room_key, {
        room_name: formatRoomNameForDisplay(row.room_key),
        room_key: row.room_key,
        floor: row.floor || undefined,
        length_m: row.length_m || undefined,
        width_m: row.width_m || undefined,
        area_sqm: row.area_sqm ? parseFloat(row.area_sqm) : undefined,
        ceiling_height_m: row.ceiling_height_m ? parseFloat(row.ceiling_height_m) : undefined,
        extraction_confidence: row.confidence || 0.95,
        verified: true,
        unit_id: row.unit_id,
        source: 'verified_unit',
      });
    }
  }
  
  const verifiedHouseTypeRooms = await db.execute<{
    room_name: string;
    room_key: string;
    floor: string | null;
    length_m: number | null;
    width_m: number | null;
    area_sqm: string | null;
    ceiling_height_m: string | null;
    confidence: number;
    verified: boolean;
  }>(sql`
    SELECT room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, confidence, verified
    FROM unit_room_dimensions
    WHERE tenant_id = ${tenantId}::uuid
      AND unit_type_code = ${houseTypeCode}
      AND verified = true
      AND unit_id IS NULL
    ORDER BY confidence DESC
  `);
  
  for (const row of verifiedHouseTypeRooms.rows || []) {
    if (!rooms.has(row.room_key)) {
      rooms.set(row.room_key, {
        room_name: formatRoomNameForDisplay(row.room_key),
        room_key: row.room_key,
        floor: row.floor || undefined,
        length_m: row.length_m || undefined,
        width_m: row.width_m || undefined,
        area_sqm: row.area_sqm ? parseFloat(row.area_sqm) : undefined,
        ceiling_height_m: row.ceiling_height_m ? parseFloat(row.ceiling_height_m) : undefined,
        extraction_confidence: row.confidence || 0.95,
        verified: true,
        source: 'verified_house_type',
      });
    }
  }
  
  const unverifiedRooms = await db.execute<{
    room_name: string;
    room_key: string;
    floor: string | null;
    length_m: number | null;
    width_m: number | null;
    area_sqm: string | null;
    ceiling_height_m: string | null;
    confidence: number;
    unit_id: string | null;
  }>(sql`
    SELECT room_name, room_key, floor, length_m, width_m, area_sqm, ceiling_height_m, confidence, unit_id
    FROM unit_room_dimensions
    WHERE tenant_id = ${tenantId}::uuid
      AND unit_type_code = ${houseTypeCode}
      AND verified = false
    ORDER BY confidence DESC
  `);
  
  for (const row of unverifiedRooms.rows || []) {
    if (!rooms.has(row.room_key)) {
      rooms.set(row.room_key, {
        room_name: formatRoomNameForDisplay(row.room_key),
        room_key: row.room_key,
        floor: row.floor || undefined,
        length_m: row.length_m || undefined,
        width_m: row.width_m || undefined,
        area_sqm: row.area_sqm ? parseFloat(row.area_sqm) : undefined,
        ceiling_height_m: row.ceiling_height_m ? parseFloat(row.ceiling_height_m) : undefined,
        extraction_confidence: row.confidence || 0.7,
        verified: false,
        unit_id: row.unit_id || undefined,
        source: 'vision_floorplan',
      });
    }
  }
  
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
      if (value && (value.length_m || value.area_sqm) && !rooms.has(key)) {
        rooms.set(key, {
          room_name: formatRoomNameForDisplay(key),
          room_key: key,
          length_m: value.length_m,
          width_m: value.width_m,
          area_sqm: value.area_sqm,
          source_document_id: profile.source_document_ids?.[0],
          extraction_confidence: value.confidence || 0.8,
          verified: false,
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
      if (value && (value.length_m || value.area_sqm) && !rooms.has(key)) {
        rooms.set(key, {
          room_name: formatRoomNameForDisplay(key),
          room_key: key,
          length_m: value.length_m,
          width_m: value.width_m,
          area_sqm: value.area_sqm,
          extraction_confidence: 1.0,
          verified: false,
          source: 'house_types',
        });
      }
    }
  }
  
  return Array.from(rooms.values());
}

export function formatGroundedDimensionAnswer(
  room: CanonicalRoomDimension,
  houseTypeCode: string,
  address?: string
): string {
  const parts: string[] = [];
  
  if (room.length_m && room.width_m) {
    parts.push(`Your ${room.room_name} measures approximately ${room.length_m.toFixed(1)}m × ${room.width_m.toFixed(1)}m`);
    
    const area = room.area_sqm || (room.length_m * room.width_m);
    parts.push(`giving a floor area of ${area.toFixed(1)} m²`);
  } else if (room.area_sqm) {
    parts.push(`Your ${room.room_name} has a floor area of approximately ${room.area_sqm.toFixed(1)} m²`);
  }
  
  if (room.ceiling_height_m) {
    parts.push(`with a ceiling height of ${room.ceiling_height_m.toFixed(2)}m`);
  }
  
  let answer = parts.join(', ') + '.';
  
  const sourceDescriptions: Record<string, string> = {
    'verified_unit': 'verified measurements for your specific unit',
    'verified_house_type': 'verified measurements for your house type',
    'vision_floorplan': 'extracted from your floor plans',
    'intelligence_profile': 'extracted from your documents',
    'house_types': 'from the specifications',
    'manual': 'from manual entry',
  };
  
  const sourceDesc = sourceDescriptions[room.source] || 'from available data';
  
  answer += ` This is based on ${sourceDesc} for your ${houseTypeCode} house type`;
  
  if (address) {
    answer += ` at ${address}`;
  }
  
  answer += '.';
  
  if (!room.verified && room.source !== 'house_types') {
    answer += ' Note: These dimensions are from automated extraction and may require verification.';
  }
  
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
  address?: string,
  unitId?: string
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
  
  const lookup = await getCanonicalRoomDimension(tenantId, developmentId, houseTypeCode, roomKey, unitId);
  
  if (lookup.found && lookup.room) {
    const confidence = lookup.room.extraction_confidence;
    
    if (confidence >= 0.75 && (lookup.room.length_m || lookup.room.area_sqm)) {
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
