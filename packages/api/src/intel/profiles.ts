import { db } from '@openhouse/db';
import { unit_intelligence_profiles, intel_extractions, documents, houseTypes } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { RoomExtraction, SupplierExtraction, VisionExtractionResult } from '../extractors/vision';

export interface RoomData {
  length_m: number;
  width_m: number;
  area_sqm: number;
  door_width_mm?: number;
  window_width_mm?: number;
  flooring?: string;
  features?: string[];
  notes?: string;
  source: 'vision' | 'ocr' | 'text' | 'manual';
  confidence: number;
}

export interface SupplierData {
  name: string;
  model?: string;
  contact?: string;
  notes?: string;
  source: 'vision' | 'ocr' | 'text' | 'manual';
  confidence: number;
}

export interface IntelligenceProfile {
  id?: string;
  tenant_id: string;
  development_id: string;
  profile_scope: 'house_type' | 'unit';
  house_type_code?: string;
  unit_id?: string;
  version: number;
  status: 'draft' | 'verified' | 'curated';
  quality_score: number;
  floor_area_total_sqm?: number;
  rooms: Record<string, RoomData>;
  suppliers: Record<string, SupplierData>;
  ber_rating?: string;
  heating?: string;
  field_confidence: Record<string, number>;
  extraction_passes: ExtractionPass[];
  source_document_ids: string[];
}

export interface ExtractionPass {
  method: 'unpdf' | 'ocr' | 'gpt4o_vision' | 'manual';
  model?: string;
  cost_cents: number;
  timestamp: string;
  sources: string[];
  notes?: string;
}

function normalizeRoomName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

function normalizeSupplierCategory(category: string): string {
  return category
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

function calculateQualityScore(profile: Partial<IntelligenceProfile>): number {
  let score = 0;
  let maxScore = 0;
  
  if (profile.floor_area_total_sqm) {
    score += 20;
  }
  maxScore += 20;
  
  const roomCount = Object.keys(profile.rooms || {}).length;
  if (roomCount >= 5) {
    score += 30;
  } else if (roomCount >= 3) {
    score += 20;
  } else if (roomCount >= 1) {
    score += 10;
  }
  maxScore += 30;
  
  const roomsWithDimensions = Object.values(profile.rooms || {}).filter(
    (r: RoomData) => r.length_m && r.width_m
  ).length;
  if (roomsWithDimensions === roomCount && roomCount > 0) {
    score += 25;
  } else if (roomsWithDimensions > 0) {
    score += 15 * (roomsWithDimensions / Math.max(roomCount, 1));
  }
  maxScore += 25;
  
  const supplierCount = Object.keys(profile.suppliers || {}).length;
  if (supplierCount >= 3) {
    score += 15;
  } else if (supplierCount >= 1) {
    score += 10;
  }
  maxScore += 15;
  
  if (profile.ber_rating) score += 5;
  if (profile.heating) score += 5;
  maxScore += 10;
  
  return Math.round((score / maxScore) * 100);
}

export async function getLatestProfile(
  tenantId: string,
  developmentId: string,
  houseTypeCode: string
): Promise<IntelligenceProfile | null> {
  const profiles = await db
    .select()
    .from(unit_intelligence_profiles)
    .where(
      and(
        eq(unit_intelligence_profiles.tenant_id, tenantId),
        eq(unit_intelligence_profiles.development_id, developmentId),
        eq(unit_intelligence_profiles.house_type_code, houseTypeCode),
        eq(unit_intelligence_profiles.is_current, true)
      )
    )
    .limit(1);
  
  if (profiles.length === 0) {
    return null;
  }
  
  const p = profiles[0];
  return {
    id: p.id,
    tenant_id: p.tenant_id,
    development_id: p.development_id,
    profile_scope: p.profile_scope as 'house_type' | 'unit',
    house_type_code: p.house_type_code || undefined,
    unit_id: p.unit_id || undefined,
    version: p.version,
    status: p.status as 'draft' | 'verified' | 'curated',
    quality_score: p.quality_score || 0,
    floor_area_total_sqm: p.floor_area_total_sqm ? parseFloat(p.floor_area_total_sqm) : undefined,
    rooms: (p.rooms as Record<string, RoomData>) || {},
    suppliers: (p.suppliers as Record<string, SupplierData>) || {},
    ber_rating: p.ber_rating || undefined,
    heating: p.heating || undefined,
    field_confidence: (p.field_confidence as Record<string, number>) || {},
    extraction_passes: (p.extraction_passes as ExtractionPass[]) || [],
    source_document_ids: p.source_document_ids || [],
  };
}

export async function mergeVisionExtractionIntoProfile(
  tenantId: string,
  developmentId: string,
  houseTypeCode: string,
  documentId: string,
  visionResult: VisionExtractionResult
): Promise<IntelligenceProfile> {
  console.log(`\n📊 MERGING VISION EXTRACTION INTO PROFILE`);
  console.log(`   House Type: ${houseTypeCode}`);
  console.log(`   Document: ${documentId}`);
  console.log(`   Rooms Extracted: ${visionResult.rooms.length}`);
  console.log(`   Suppliers Extracted: ${visionResult.suppliers.length}`);
  
  let profile = await getLatestProfile(tenantId, developmentId, houseTypeCode);
  
  if (!profile) {
    console.log(`   Creating new profile for ${houseTypeCode}`);
    profile = {
      tenant_id: tenantId,
      development_id: developmentId,
      profile_scope: 'house_type',
      house_type_code: houseTypeCode,
      version: 1,
      status: 'draft',
      quality_score: 0,
      rooms: {},
      suppliers: {},
      field_confidence: {},
      extraction_passes: [],
      source_document_ids: [],
    };
  }
  
  for (const room of visionResult.rooms) {
    const key = normalizeRoomName(room.name);
    const existing = profile.rooms[key];
    
    if (!existing || room.confidence > existing.confidence) {
      profile.rooms[key] = {
        length_m: room.length_m || 0,
        width_m: room.width_m || 0,
        area_sqm: room.area_sqm || (room.length_m && room.width_m ? room.length_m * room.width_m : 0),
        door_width_mm: room.door_width_mm,
        window_width_mm: room.window_width_mm,
        notes: room.notes,
        source: 'vision',
        confidence: room.confidence,
      };
      profile.field_confidence[`rooms.${key}`] = room.confidence;
    }
  }
  
  for (const supplier of visionResult.suppliers) {
    const key = normalizeSupplierCategory(supplier.category);
    const existing = profile.suppliers[key];
    
    if (!existing || supplier.confidence > existing.confidence) {
      profile.suppliers[key] = {
        name: supplier.name,
        model: supplier.model,
        contact: supplier.contact,
        notes: supplier.notes,
        source: 'vision',
        confidence: supplier.confidence,
      };
      profile.field_confidence[`suppliers.${key}`] = supplier.confidence;
    }
  }
  
  if (visionResult.total_floor_area_sqm) {
    profile.floor_area_total_sqm = visionResult.total_floor_area_sqm;
    profile.field_confidence['floor_area_total_sqm'] = 0.9;
  }
  
  if (visionResult.ber_rating) {
    profile.ber_rating = visionResult.ber_rating;
    profile.field_confidence['ber_rating'] = 0.9;
  }
  
  if (visionResult.heating_type) {
    profile.heating = visionResult.heating_type;
    profile.field_confidence['heating'] = 0.9;
  }
  
  if (!profile.source_document_ids.includes(documentId)) {
    profile.source_document_ids.push(documentId);
  }
  
  profile.extraction_passes.push({
    method: 'gpt4o_vision',
    model: visionResult.model_version,
    cost_cents: visionResult.cost_cents,
    timestamp: new Date().toISOString(),
    sources: [documentId],
    notes: `Extracted ${visionResult.rooms.length} rooms, ${visionResult.suppliers.length} suppliers from ${visionResult.pages_processed} pages`,
  });
  
  profile.quality_score = calculateQualityScore(profile);
  
  await saveProfile(profile);
  
  console.log(`   ✅ Profile updated: Quality Score ${profile.quality_score}%`);
  console.log(`   Total Rooms: ${Object.keys(profile.rooms).length}`);
  console.log(`   Total Suppliers: ${Object.keys(profile.suppliers).length}\n`);
  
  return profile;
}

export async function saveProfile(profile: IntelligenceProfile): Promise<string> {
  const oldProfileId = profile.id;
  const newVersion = oldProfileId ? profile.version + 1 : 1;
  
  const [inserted] = await db
    .insert(unit_intelligence_profiles)
    .values({
      tenant_id: profile.tenant_id,
      development_id: profile.development_id,
      profile_scope: profile.profile_scope,
      house_type_code: profile.house_type_code,
      unit_id: profile.unit_id,
      version: newVersion,
      is_current: true,
      status: profile.status,
      quality_score: profile.quality_score,
      floor_area_total_sqm: profile.floor_area_total_sqm?.toString(),
      rooms: profile.rooms,
      suppliers: profile.suppliers,
      ber_rating: profile.ber_rating,
      heating: profile.heating,
      field_confidence: profile.field_confidence,
      extraction_passes: profile.extraction_passes,
      source_document_ids: profile.source_document_ids,
    })
    .returning({ id: unit_intelligence_profiles.id });
  
  if (oldProfileId) {
    await db
      .update(unit_intelligence_profiles)
      .set({ 
        is_current: false,
        superseded_by: inserted.id,
      })
      .where(eq(unit_intelligence_profiles.id, oldProfileId));
  }
  
  return inserted.id;
}

export interface ChatProfile {
  rooms: Record<string, RoomData>;
  suppliers: Record<string, SupplierData>;
  specs: {
    ber_rating?: string;
    heating_system?: string;
    ventilation?: string;
    insulation?: string;
    appliances?: string[];
  };
  floor_area_total_sqm?: number;
  version: number;
  overallConfidence: number;
  source: 'intelligence_profile' | 'house_types_fallback' | 'none';
}

export async function getProfileForChat(
  tenantId: string,
  developmentId: string,
  houseTypeCode: string
): Promise<ChatProfile | null> {
  const profile = await getLatestProfile(tenantId, developmentId, houseTypeCode);
  
  if (profile && profile.quality_score > 20) {
    return {
      rooms: profile.rooms,
      suppliers: profile.suppliers,
      specs: {
        ber_rating: profile.ber_rating,
        heating_system: profile.heating,
      },
      floor_area_total_sqm: profile.floor_area_total_sqm,
      version: profile.version,
      overallConfidence: profile.quality_score / 100,
      source: 'intelligence_profile',
    };
  }
  
  const houseType = await db
    .select()
    .from(houseTypes)
    .where(
      and(
        eq(houseTypes.development_id, developmentId),
        eq(houseTypes.house_type_code, houseTypeCode)
      )
    )
    .limit(1);
  
  if (houseType.length > 0 && houseType[0].room_dimensions) {
    const roomDims = houseType[0].room_dimensions as Record<string, any>;
    const rooms: Record<string, RoomData> = {};
    
    for (const [key, value] of Object.entries(roomDims)) {
      if (typeof value === 'object' && value !== null) {
        rooms[key] = {
          length_m: value.length_m || 0,
          width_m: value.width_m || 0,
          area_sqm: value.area_sqm || 0,
          source: 'manual',
          confidence: 1.0,
        };
      }
    }
    
    return {
      rooms,
      suppliers: {},
      specs: {},
      floor_area_total_sqm: houseType[0].total_floor_area_sqm 
        ? parseFloat(houseType[0].total_floor_area_sqm) 
        : undefined,
      version: 1,
      overallConfidence: 0.5,
      source: 'house_types_fallback',
    };
  }
  
  return null;
}

export async function syncHouseTypesToProfiles(
  tenantId: string,
  developmentId: string
): Promise<number> {
  console.log(`\n🔄 SYNCING HOUSE TYPES TO INTELLIGENCE PROFILES`);
  
  const houseTypesData = await db
    .select()
    .from(houseTypes)
    .where(
      and(
        eq(houseTypes.tenant_id, tenantId),
        eq(houseTypes.development_id, developmentId)
      )
    );
  
  let synced = 0;
  
  for (const ht of houseTypesData) {
    if (!ht.room_dimensions && !ht.total_floor_area_sqm) {
      continue;
    }
    
    const existing = await getLatestProfile(tenantId, developmentId, ht.house_type_code);
    
    if (existing) {
      continue;
    }
    
    const roomDims = (ht.room_dimensions || {}) as Record<string, any>;
    const rooms: Record<string, RoomData> = {};
    
    for (const [key, value] of Object.entries(roomDims)) {
      if (typeof value === 'object' && value !== null) {
        rooms[key] = {
          length_m: value.length_m || 0,
          width_m: value.width_m || 0,
          area_sqm: value.area_sqm || 0,
          notes: value.notes,
          source: 'manual',
          confidence: 1.0,
        };
      }
    }
    
    const profile: IntelligenceProfile = {
      tenant_id: tenantId,
      development_id: developmentId,
      profile_scope: 'house_type',
      house_type_code: ht.house_type_code,
      version: 1,
      status: 'verified',
      quality_score: calculateQualityScore({
        floor_area_total_sqm: ht.total_floor_area_sqm ? parseFloat(ht.total_floor_area_sqm) : undefined,
        rooms,
        suppliers: {},
      }),
      floor_area_total_sqm: ht.total_floor_area_sqm ? parseFloat(ht.total_floor_area_sqm) : undefined,
      rooms,
      suppliers: {},
      field_confidence: {},
      extraction_passes: [{
        method: 'manual',
        cost_cents: 0,
        timestamp: new Date().toISOString(),
        sources: [],
        notes: 'Synced from house_types table',
      }],
      source_document_ids: [],
    };
    
    await saveProfile(profile);
    synced++;
    console.log(`   ✅ Created profile for ${ht.house_type_code}`);
  }
  
  console.log(`   Synced ${synced} house types to profiles\n`);
  return synced;
}
