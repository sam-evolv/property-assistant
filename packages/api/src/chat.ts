import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { resolveTenantFromRequest } from './tenancy';
import { searchSimilarChunks, MatchedChunk } from './vector-store';
import { chatRateLimiter, getRateLimitKey } from './rate-limiter';
import { logger, withTiming } from './logger';
import { apiCache } from './cache';
import { verifyQRToken } from './qr-tokens';
import { hybridRetrieval, HybridChunk } from './hybrid-retrieval';
import { unitFirstRetrieval, UnitFirstChunk, getAnswerConfidence } from './unit-first-retrieval';
import { getProfileForChat, RoomData, SupplierData } from './intel/profiles';
import { 
  applyDimensionGuardrail, 
  validateLLMResponseForDimensions,
  isDimensionQuestion,
  extractRoomNameFromQuestion,
  SAFE_DIMENSION_FALLBACK,
  DimensionGuardrailResult,
} from './dimension-guardrail';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChatRequest {
  developmentId: string;
  message: string;
}

interface UnitDetails {
  id: string;
  unit_number: string;
  address_line_1: string;
  house_type_code: string;
  purchaser_name: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  floor_area_m2: string | null;
  last_chat_at: Date | null;
}

/**
 * Helper function to extract room dimensions from retrieved context
 * and compute floor area for room-size questions
 */
function extractRoomDimensions(context: string): string | null {
  // Find all measurements in format like "3.8 m", "6.3m", "3.8 meters"
  const matches = context.match(/(\d+(?:\.\d+)?)\s*(?:m\b|meters?)/gi);
  
  if (!matches || matches.length < 2) return null;

  // Extract numeric values from first two matches
  const values = matches.slice(0, 2).map(m => {
    const num = parseFloat(m.replace(/[^\d.]/g, ''));
    return isNaN(num) ? null : num;
  }).filter(v => v !== null) as number[];

  if (values.length < 2) return null;

  const [d1, d2] = values;
  const area = d1 * d2;

  return `Detected dimensions from plans: ${d1.toFixed(1)} m by ${d2.toFixed(1)} m. Calculated floor area: ${area.toFixed(1)} m².`;
}

interface RoomDimension {
  length_m: number;
  width_m: number;
  area_sqm: number;
}

interface RoomDimensions {
  [roomName: string]: RoomDimension;
}

/**
 * Get structured room dimensions from house_types table
 */
async function getStructuredRoomDimensions(
  developmentId: string, 
  houseTypeCode: string
): Promise<{ total_floor_area_sqm: number | null; room_dimensions: RoomDimensions | null }> {
  try {
    const result = await db.execute<{
      total_floor_area_sqm: string | null;
      room_dimensions: RoomDimensions | null;
    }>(sql`
      SELECT total_floor_area_sqm, room_dimensions
      FROM house_types
      WHERE development_id = ${developmentId}::uuid
        AND house_type_code = ${houseTypeCode}
      LIMIT 1
    `);
    
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        total_floor_area_sqm: row.total_floor_area_sqm ? parseFloat(row.total_floor_area_sqm) : null,
        room_dimensions: row.room_dimensions || null,
      };
    }
    return { total_floor_area_sqm: null, room_dimensions: null };
  } catch (error) {
    console.error('Error fetching structured room dimensions:', error);
    return { total_floor_area_sqm: null, room_dimensions: null };
  }
}

/**
 * Match a user's room query to the correct room key in the database
 */
function matchRoomToKey(query: string): string | null {
  const queryLower = query.toLowerCase();
  
  const roomMappings: { [key: string]: string[] } = {
    'living_room': ['living room', 'sitting room', 'lounge', 'front room'],
    'kitchen_dining': ['kitchen', 'dining', 'kitchen/dining', 'kitchen dining'],
    'utility': ['utility', 'utility room', 'storage'],
    'toilet': ['toilet', 'wc', 'downstairs toilet', 'ground floor toilet'],
    'entrance_hall': ['hall', 'entrance', 'hallway', 'entrance hall'],
    'bedroom_1': ['bedroom 1', 'bedroom one', 'main bedroom', 'master bedroom'],
    'bedroom_2': ['bedroom 2', 'bedroom two', 'second bedroom'],
    'bedroom_3': ['bedroom 3', 'bedroom three', 'third bedroom'],
    'bedroom_4': ['bedroom 4', 'bedroom four', 'fourth bedroom'],
    'ensuite': ['ensuite', 'en-suite', 'en suite', 'master bathroom'],
    'bathroom': ['bathroom', 'main bathroom', 'family bathroom'],
    'landing': ['landing', 'upstairs landing', 'upper landing'],
  };
  
  for (const [key, variants] of Object.entries(roomMappings)) {
    for (const variant of variants) {
      if (queryLower.includes(variant)) {
        return key;
      }
    }
  }
  
  return null;
}

/**
 * Format room dimensions for display
 */
function formatRoomDimensionsForAnswer(
  roomKey: string, 
  dimensions: RoomDimension
): string {
  const roomNames: { [key: string]: string } = {
    'living_room': 'living room',
    'kitchen_dining': 'kitchen/dining area',
    'utility': 'utility room',
    'toilet': 'toilet',
    'entrance_hall': 'entrance hall',
    'bedroom_1': 'main bedroom (bedroom 1)',
    'bedroom_2': 'bedroom 2',
    'bedroom_3': 'bedroom 3',
    'bedroom_4': 'bedroom 4',
    'ensuite': 'ensuite bathroom',
    'bathroom': 'bathroom',
    'landing': 'landing',
  };
  
  const roomName = roomNames[roomKey] || roomKey.replace(/_/g, ' ');
  
  return `Your ${roomName} measures approximately ${dimensions.length_m.toFixed(1)}m x ${dimensions.width_m.toFixed(1)}m, giving a floor area of ${dimensions.area_sqm.toFixed(1)} m².`;
}

export async function handleChatRequest(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json() as ChatRequest;
    const { developmentId, message } = body;

    if (!developmentId) {
      return NextResponse.json(
        { error: 'developmentId is required' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    let tenant = await resolveTenantFromRequest(req.headers);
    
    if (!tenant?.id) {
      const devResult = await db.execute<{tenant_id: string}>(sql`
        SELECT tenant_id FROM developments WHERE id = ${developmentId}::uuid LIMIT 1
      `);
      
      if (!devResult.rows || devResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Development not found' },
          { status: 404 }
        );
      }
      
      const devTenantId = devResult.rows[0].tenant_id;
      
      const tenantResult = await db.execute<{id: string, slug: string, name: string}>(sql`
        SELECT id, slug, name FROM tenants WHERE id = ${devTenantId}::uuid LIMIT 1
      `);
      
      if (tenantResult.rows && tenantResult.rows.length > 0) {
        tenant = tenantResult.rows[0] as any;
      } else {
        return NextResponse.json(
          { error: 'Tenant not found for development' },
          { status: 404 }
        );
      }
    }

    const tenantId = tenant.id;
    
    const rateLimitKey = getRateLimitKey(tenantId, 'chat');
    const rateLimitResult = await chatRateLimiter.check(rateLimitKey);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Chat rate limit exceeded', { 
        tenantId, 
        developmentId,
        resetTime: rateLimitResult.resetTime 
      });
      
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
          }
        }
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('💬 CHAT API - RAG REQUEST');
    console.log('='.repeat(80));
    console.log(`Development: ${developmentId}`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Query: ${message}`);
    console.log('');

    // STEP 1: Extract unit details from QR token
    console.log('STEP 1: EXTRACTING PURCHASER CONTEXT');
    console.log('-'.repeat(80));
    
    const qrToken = req.headers.get('x-qr-token');
    let unitDetails: UnitDetails | null = null;
    let isFirstChat = false;
    
    if (qrToken) {
      const tokenPayload = verifyQRToken(qrToken);
      
      if (tokenPayload) {
        const unitResult = await db.execute<UnitDetails>(sql`
          SELECT 
            id,
            unit_number,
            address_line_1,
            house_type_code,
            purchaser_name,
            bedrooms,
            bathrooms,
            square_footage,
            floor_area_m2,
            last_chat_at
          FROM units
          WHERE unit_uid = ${tokenPayload.unitUid}
          LIMIT 1
        `);
        
        if (unitResult.rows && unitResult.rows.length > 0) {
          unitDetails = unitResult.rows[0];
          isFirstChat = !unitDetails.last_chat_at;
          
          console.log(`✅ Purchaser: ${unitDetails.purchaser_name || 'Unknown'}`);
          console.log(`   Unit: ${unitDetails.unit_number} - ${unitDetails.address_line_1}`);
          console.log(`   House Type: ${unitDetails.house_type_code}`);
          console.log(`   First Chat: ${isFirstChat ? 'YES' : 'NO'}\n`);
          
          if (isFirstChat) {
            await db.execute(sql`
              UPDATE units 
              SET last_chat_at = NOW()
              WHERE id = ${unitDetails.id}::uuid
            `);
            console.log(`✅ Updated last_chat_at for first-time user\n`);
          }
        }
      }
    }
    
    if (!unitDetails) {
      console.log('⚠️  No QR token or unit details found - using generic context\n');
    }

    // STEP 1.5: DIMENSION GUARDRAIL - Strict grounding for room size questions
    // This must run BEFORE any RAG retrieval to prevent LLM fabrication
    console.log('STEP 1.5: DIMENSION GUARDRAIL CHECK');
    console.log('-'.repeat(80));
    
    let dimensionGuardrailResult: DimensionGuardrailResult = { shouldIntercept: false, lookupSuccessful: false };
    
    if (isDimensionQuestion(message)) {
      console.log(`🔒 DIMENSION QUESTION DETECTED`);
      console.log(`   Query: "${message}"`);
      
      dimensionGuardrailResult = await applyDimensionGuardrail(
        message,
        tenantId,
        developmentId,
        unitDetails?.house_type_code,
        unitDetails?.address_line_1
      );
      
      if (dimensionGuardrailResult.shouldIntercept && dimensionGuardrailResult.groundedAnswer) {
        if (dimensionGuardrailResult.lookupSuccessful) {
          console.log(`✅ GROUNDED ANSWER from canonical data`);
          console.log(`   Room: ${dimensionGuardrailResult.roomKey}`);
          console.log(`   Answer: ${dimensionGuardrailResult.groundedAnswer.substring(0, 100)}...`);
        } else {
          console.log(`⚠️  NO VERIFIED DATA - Using safe fallback`);
          console.log(`   Room: ${dimensionGuardrailResult.roomKey}`);
        }
        
        // Log the grounded dimension response
        const duration = Date.now() - startTime;
        try {
          const userId = unitDetails?.id || `anonymous-${developmentId}`;
          await db.execute(sql`
            INSERT INTO messages (
              tenant_id, development_id, house_id, user_id, sender, content,
              user_message, ai_message, source, token_count, cost_usd, latency_ms,
              metadata, created_at
            ) VALUES (
              ${tenantId}::uuid, ${developmentId}::uuid, NULL, ${userId}, 'user',
              ${message}, ${message}, ${dimensionGuardrailResult.groundedAnswer}, 'dimension_guardrail',
              0, 0, ${duration},
              ${JSON.stringify({
                guardrail_type: 'dimension',
                room_key: dimensionGuardrailResult.roomKey,
                lookup_successful: dimensionGuardrailResult.lookupSuccessful,
                house_type: unitDetails?.house_type_code,
                unit_number: unitDetails?.unit_number,
              })}::jsonb,
              NOW()
            )
          `);
        } catch (logError) {
          console.log(`⚠️ Failed to log dimension response: ${logError instanceof Error ? logError.message : 'Unknown'}`);
        }
        
        console.log('='.repeat(80));
        console.log('');
        
        return NextResponse.json({
          success: true,
          answer: dimensionGuardrailResult.groundedAnswer,
          chunksUsed: 0,
          source: dimensionGuardrailResult.lookupSuccessful ? 'dimension_guardrail' : 'dimension_fallback',
          grounded: dimensionGuardrailResult.lookupSuccessful,
          suggestFloorplan: dimensionGuardrailResult.suggestFloorplan,
        });
      }
    } else {
      console.log(`   Not a dimension question - proceeding to RAG\n`);
    }

    // STEP 1.6: Check for structured data queries (ONLY total floor area, not room-specific)
    const messageLower = message.toLowerCase();
    
    // Only trigger on queries about TOTAL/OVERALL floor area, not specific rooms
    const isTotalAreaQuery = /total\s+(floor\s+)?area|overall\s+size|house\s+size|home\s+size|how\s+big\s+is\s+(the\s+)?(house|home|property)|square\s+(feet|footage|meters?|metres?)/.test(messageLower);
    const isSpecificRoomQuery = /living\s+room|bedroom|bathroom|kitchen|dining|garage|hall|utility/.test(messageLower);
    
    if (isTotalAreaQuery && !isSpecificRoomQuery && unitDetails && unitDetails.floor_area_m2) {
      console.log('STRUCTURED DATA QUERY DETECTED - Total Floor Area');
      console.log('-'.repeat(80));
      console.log(`Query pattern: Total floor area question (not room-specific)`);
      console.log(`Structured data available: ${unitDetails.floor_area_m2} m² (${unitDetails.square_footage} sqft)`);
      console.log(`Answering directly from unit database without RAG retrieval\n`);
      
      const structuredAnswer = `Your ${unitDetails.house_type_code} home at ${unitDetails.address_line_1} has a total floor area of approximately ${unitDetails.floor_area_m2} m² (${unitDetails.square_footage} square feet). This is a ${unitDetails.bedrooms}-bedroom, ${unitDetails.bathrooms}-bathroom home. Would you like to know the dimensions of a specific room?`;
      
      return NextResponse.json({
        success: true,
        answer: structuredAnswer,
        chunksUsed: 0,
        source: 'structured_data',
      });
    }

    // STEP 2: Unit-First Retrieval (strict tiered weighting)
    console.log('STEP 2: UNIT-FIRST RETRIEVAL');
    console.log('-'.repeat(80));
    
    const retrievalResult = await unitFirstRetrieval({
      tenantId,
      developmentId,
      unitId: unitDetails?.id,
      houseTypeCode: unitDetails?.house_type_code,
      query: message,
      limit: 10,
      includeGlobalFallback: true,
    });
    
    const chunks: UnitFirstChunk[] = retrievalResult.chunks;
    const ragConfidence = retrievalResult.confidence;
    const tierBreakdown = retrievalResult.tierBreakdown;
    
    console.log(`✅ Unit-first retrieval: ${chunks.length} chunks, confidence: ${ragConfidence}`);
    console.log(`   Tiers: unit=${tierBreakdown.unit || 0}, house_type=${tierBreakdown.house_type || 0}, important=${tierBreakdown.important || 0}, dev=${tierBreakdown.development || 0}, global=${tierBreakdown.global || 0}`);
    
    // Get answer confidence for routing decisions
    const answerConf = await getAnswerConfidence(chunks, message);
    console.log(`   Answer confidence: ${answerConf.confidence} - ${answerConf.explanation}\n`);
    
    // =========================================================================
    // 4-LAYER FALLBACK SYSTEM
    // Layer 1: RAG Direct - Use chunks if confidence is high
    // Layer 2: Intelligence Profile - Use structured extracted data
    // Layer 3: Vision-on-demand - Trigger GPT-4o Vision for visual questions
    // Layer 4: AI Reasoning - Best-effort answer with available context
    // =========================================================================
    
    console.log('STEP 3: 4-LAYER FALLBACK EVALUATION');
    console.log('-'.repeat(80));
    
    // Detect query intent for routing
    const isRoomQuery = /room|bedroom|bathroom|kitchen|living|dining|utility|garage|hall|landing|ensuite/.test(messageLower);
    const isSupplierQuery = /supplier|manufacturer|who\s+(made|installed|provided|supplies)|company|brand/.test(messageLower);
    const isSpecQuery = /ber|energy|rating|insulation|heating|ventilation|appliance|specification/.test(messageLower);
    const isDimensionQuery = /size|dimension|how\s+big|area|measure|sqm|m²|square|floor\s+area|width|length|height/.test(messageLower);
    const isFloorplanQuery = /floor\s*plan|layout|plan|where\s+is/.test(messageLower);
    
    // Calculate RAG confidence based on retrieval result
    const avgChunkScore = retrievalResult.confidenceScore;
    const hasHighConfidenceRAG = ragConfidence === 'high' || (chunks.length >= 3 && avgChunkScore > 0.6);
    
    console.log(`   Query intent: ${[
      isRoomQuery && 'ROOM',
      isSupplierQuery && 'SUPPLIER', 
      isSpecQuery && 'SPECS',
      isDimensionQuery && 'DIMENSIONS',
      isFloorplanQuery && 'FLOORPLAN'
    ].filter(Boolean).join(', ') || 'GENERAL'}`);
    console.log(`   RAG confidence: ${avgChunkScore.toFixed(3)} (${hasHighConfidenceRAG ? 'HIGH' : 'LOW'})`);
    
    // Layer 2: Intelligence Profile lookup for structured data questions
    let profileContext = '';
    let profileSource: 'profile' | 'rag' | 'vision' | 'reasoning' = 'rag';
    
    if (unitDetails && (isRoomQuery || isSupplierQuery || isSpecQuery || isDimensionQuery) && !hasHighConfidenceRAG) {
      console.log(`\n   Layer 2: Checking Intelligence Profile...`);
      
      try {
        const profile = await getProfileForChat(
          tenantId,
          developmentId,
          unitDetails.house_type_code
        );
        
        if (profile) {
          console.log(`   ✅ Found profile v${profile.version} (confidence: ${(profile.overallConfidence * 100).toFixed(0)}%)`);
          
          // Build profile context based on query type
          const profileParts: string[] = [];
          
          if (isRoomQuery || isDimensionQuery) {
            const roomKey = matchRoomToKey(message);
            if (roomKey && profile.rooms && profile.rooms[roomKey]) {
              const room = profile.rooms[roomKey];
              const roomName = roomKey.replace(/_/g, ' ');
              profileParts.push(`INTELLIGENCE PROFILE - ${roomName.toUpperCase()}:`);
              if (room.length_m && room.width_m) {
                profileParts.push(`  Dimensions: ${room.length_m}m × ${room.width_m}m`);
              }
              if (room.area_sqm) {
                profileParts.push(`  Floor Area: ${room.area_sqm} m²`);
              }
              if (room.flooring) {
                profileParts.push(`  Flooring: ${room.flooring}`);
              }
              if (room.features && room.features.length > 0) {
                profileParts.push(`  Features: ${room.features.join(', ')}`);
              }
              profileParts.push(`  Confidence: ${((room.confidence || 0) * 100).toFixed(0)}%`);
              profileSource = 'profile';
            } else if (profile.rooms) {
              // List all available rooms
              profileParts.push('INTELLIGENCE PROFILE - ROOM DIMENSIONS:');
              for (const [key, room] of Object.entries(profile.rooms)) {
                const r = room as RoomData;
                if (r.length_m && r.width_m) {
                  const roomName = key.replace(/_/g, ' ');
                  profileParts.push(`  ${roomName}: ${r.length_m}m × ${r.width_m}m = ${r.area_sqm || (r.length_m * r.width_m).toFixed(1)} m²`);
                }
              }
              profileSource = 'profile';
            }
          }
          
          if (isSupplierQuery && profile.suppliers) {
            profileParts.push('INTELLIGENCE PROFILE - SUPPLIERS:');
            for (const [category, supplier] of Object.entries(profile.suppliers)) {
              const s = supplier as SupplierData;
              profileParts.push(`  ${category}: ${s.name}${s.contact ? ` (${s.contact})` : ''}`);
            }
            profileSource = 'profile';
          }
          
          if (isSpecQuery && profile.specs) {
            profileParts.push('INTELLIGENCE PROFILE - SPECIFICATIONS:');
            if (profile.specs.ber_rating) profileParts.push(`  BER Rating: ${profile.specs.ber_rating}`);
            if (profile.specs.heating_system) profileParts.push(`  Heating: ${profile.specs.heating_system}`);
            if (profile.specs.ventilation) profileParts.push(`  Ventilation: ${profile.specs.ventilation}`);
            if (profile.specs.insulation) profileParts.push(`  Insulation: ${profile.specs.insulation}`);
            if (profile.specs.appliances && profile.specs.appliances.length > 0) {
              profileParts.push(`  Appliances: ${profile.specs.appliances.join(', ')}`);
            }
            profileSource = 'profile';
          }
          
          if (profileParts.length > 0) {
            profileContext = '\n\n' + profileParts.join('\n');
            console.log(`   ✅ Added ${profileParts.length} profile data points to context`);
          } else {
            console.log(`   ⚠️  Profile exists but no relevant data for this query`);
          }
        } else {
          console.log(`   ⚠️  No intelligence profile found for ${unitDetails.house_type_code}`);
        }
      } catch (profileError) {
        console.error('   ❌ Profile lookup error:', profileError);
      }
    }
    
    // Layer 3: Vision-on-demand (for floorplan questions without profile data)
    // TODO: Implement when GPT-4o Vision integration is complete
    if (isFloorplanQuery && !profileContext && unitDetails) {
      console.log(`\n   Layer 3: Vision-on-demand (not yet implemented)`);
      console.log(`   Would trigger GPT-4o Vision analysis of floorplan documents`);
      // Future: Call vision extractor for specific pages
    }
    
    // Determine final answering strategy
    if (chunks.length === 0 && !profileContext) {
      console.log(`\n   Layer 4: No data available - returning empathetic fallback`);
      console.log('='.repeat(80));
      console.log('');
      
      return NextResponse.json({
        success: true,
        answer: "I don't have specific information about that in the documents for your home. Would you like me to check with your developer for more details?",
        chunksUsed: 0,
        source: 'fallback',
      });
    }
    
    console.log(`\n   Final source: ${profileSource.toUpperCase()}`);
    console.log('');

    console.log('STEP 4: BUILDING CONTEXT WITH DOCUMENT METADATA');
    console.log('-'.repeat(80));
    
    // Build context with document metadata and tier info for better citations
    const contextParts = chunks.map((chunk: UnitFirstChunk, idx: number) => {
      const docTitle = chunk.document_title || 'Unknown Document';
      const tierLabel = chunk.tier === 'unit' ? '[UNIT-SPECIFIC]' : 
                        chunk.tier === 'house_type' ? '[HOUSE TYPE]' : 
                        chunk.tier === 'important' ? '[IMPORTANT]' : '';
      return `[Source ${idx + 1}: ${docTitle}] ${tierLabel}\n${chunk.content}`;
    });
    
    const context = contextParts.join('\n\n---\n\n');
    
    const chunkPreviews = chunks.map((chunk: UnitFirstChunk) => ({
      id: chunk.id,
      preview: chunk.content.substring(0, 100) + '...',
      vector_score: chunk.vector_score,
      keyword_score: chunk.keyword_score,
      final_score: chunk.final_score,
      tier: chunk.tier,
    }));
    
    console.log(`✅ Built context from ${chunks.length} chunks with document metadata`);
    console.log(`   Context length: ${context.length} characters`);
    if (chunks.length > 0) {
      console.log(`   Avg final score: ${(chunks.reduce((sum: number, c: UnitFirstChunk) => sum + c.final_score, 0) / chunks.length).toFixed(3)}\n`);
    }

    console.log('STEP 5: GENERATING GROUNDED ANSWER');
    console.log('-'.repeat(80));
    
    // Build house-specific context if we have unit details
    let houseContext = '';
    if (unitDetails) {
      houseContext = '\n\nPURCHASER INFORMATION:\n';
      houseContext += `Address: ${unitDetails.address_line_1}\n`;
      houseContext += `Unit Number: ${unitDetails.unit_number}\n`;
      houseContext += `House Type: ${unitDetails.house_type_code}\n`;
      if (unitDetails.bedrooms) houseContext += `Bedrooms: ${unitDetails.bedrooms}\n`;
      if (unitDetails.bathrooms) houseContext += `Bathrooms: ${unitDetails.bathrooms}\n`;
      if (unitDetails.square_footage) houseContext += `Square Footage: ${unitDetails.square_footage} sqft\n`;
      if (unitDetails.floor_area_m2) houseContext += `Floor Area: ${unitDetails.floor_area_m2} m²\n`;
      
      houseContext += `\nIMPORTANT: This purchaser lives in house type ${unitDetails.house_type_code}. When they ask about their home, automatically use information for ${unitDetails.house_type_code} from the context. You already know their house type - never ask them for it.`;
      
      console.log(`✅ Built house-specific context for ${unitDetails.house_type_code}`);
    }
    
    // Extract room dimensions if this appears to be a room-size question
    let dimensionHint = extractRoomDimensions(context);
    let structuredRoomFallback = '';
    
    // Check if this is a room size query and RAG didn't find dimensions
    const isRoomSizeQuery = /size|dimension|how\s+big|area|measure|sqm|m²|square|floor\s+area/.test(messageLower);
    const matchedRoom = matchRoomToKey(message);
    
    if (isRoomSizeQuery && unitDetails && !dimensionHint && matchedRoom) {
      console.log('📊 No dimensions in RAG context, checking structured data fallback...');
      
      const structuredData = await getStructuredRoomDimensions(developmentId, unitDetails.house_type_code);
      
      if (structuredData.room_dimensions && structuredData.room_dimensions[matchedRoom]) {
        const roomDims = structuredData.room_dimensions[matchedRoom];
        structuredRoomFallback = formatRoomDimensionsForAnswer(matchedRoom, roomDims);
        
        console.log(`✅ STRUCTURED FALLBACK: Returning directly from database`);
        console.log(`   ${structuredRoomFallback}`);
        console.log('='.repeat(80));
        console.log('');
        
        // Return directly from structured data without LLM call
        return NextResponse.json({
          success: true,
          answer: structuredRoomFallback + ` This is based on the specifications for your ${unitDetails.house_type_code} house type at ${unitDetails.address_line_1}.`,
          chunksUsed: 0,
          source: 'structured_data',
        });
      } else if (structuredData.total_floor_area_sqm && !matchedRoom) {
        console.log(`📊 Found total floor area: ${structuredData.total_floor_area_sqm} m²`);
        dimensionHint = `Total floor area for ${unitDetails.house_type_code}: ${structuredData.total_floor_area_sqm} m²`;
      }
    }
    
    const extraSystemHint = dimensionHint
      ? `\n\nMEASUREMENT HELPER:\n${dimensionHint}\nUse these as the width and length when the user asks about room size. Always present BOTH dimensions AND the calculated area.`
      : '';
    
    if (dimensionHint) {
      console.log(`✅ Dimensions available for answer generation`);
      console.log(`   ${dimensionHint.split('\n')[0]}`);
    }
    
    // Build greeting context for first-time users only
    let greetingContext = '';
    if (isFirstChat && unitDetails?.purchaser_name) {
      greetingContext = `\n\nFIRST MESSAGE GREETING:\nThis is the purchaser's first time chatting. Start your response with a brief, warm welcome using their name: "${unitDetails.purchaser_name}". Keep it natural and conversational - just one sentence. For ALL subsequent messages, never use their name again unless they explicitly ask.`;
      console.log(`✅ First-time greeting enabled for ${unitDetails.purchaser_name}`);
    }
    
    const systemPrompt = `You are the OpenHouse Resident Assistant. 
You have access to context snippets extracted from documents linked to the user's home and development.

IMPORTANT - BEST EFFORT ANSWERING:
1. If there is ANY plausible evidence in the context addressing the question, you MUST attempt a best-effort answer
2. Each context snippet is labeled with its source document (e.g., [Source 1: Kitchen Narrative])
3. Always cite the source document when providing information (e.g., "According to the Kitchen & Wardrobe Narrative...")
4. If evidence is partial or indirect, clearly state that you are inferring based on the available documents
5. ONLY say you cannot find information when NOTHING in the context is relevant at all

When answering questions about suppliers, contractors, or installers:
- Look for company names, supplier information, manufacturer details in the context
- Pay attention to phrases like "supplied by", "installed by", "provided by", "manufacturer"
- If you find this information, provide it with confidence and cite the source document

When answering questions about the purchaser's home:
1. You ALREADY KNOW their house type from the PURCHASER INFORMATION section
2. NEVER ask them what house type they have - this information is provided to you
3. Automatically use their house type information from the CONTEXT to answer their questions
4. Be helpful and specific - if they ask "What size is my living room?", immediately answer using their house type's living room dimensions

IMPORTANT RULES FOR ROOM SIZE QUESTIONS:
When a user asks about room sizes, dimensions, or floor area:
- First, carefully read the retrieved context for ALL linear measurements in metres (e.g., "3.8 m" and "6.3 m")
- Where two dimensions are clearly present for the same room, treat them as width and length
- ALWAYS answer with BOTH dimensions (e.g., "3.8 m by 6.3 m") AND the calculated floor area in m² (e.g., "24.0 m²")
- Make it clear you are using values from the uploaded plans or documents
- If you can only see ONE dimension, say so explicitly and do NOT pretend to know the second dimension or area
- NEVER answer with just a single number like "6.3 m" as the "size" of a room - this is incomplete
- Example answer format: "Your living room is approximately 3.8 m by 6.3 m, which gives a floor area of about 24.0 m². These dimensions are from your uploaded floor plans."

ONLY if the answer is truly not in the context at all, say:
"Based on the documents available for your home, I don't see any information about that. Would you like me to check with your developer?"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt + greetingContext },
        { role: 'user', content: `CONTEXT:\n${context}${profileContext}${houseContext}${extraSystemHint}` },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    let answer = completion.choices[0].message.content || "Based on the documents available for your home, I don't see details for this item. Would you like me to check with your developer?";
    console.log(`✅ Generated answer (${answer.length} characters)\n`);

    // STEP 5.5: POST-VALIDATION - Catch any LLM-fabricated dimensions
    // This is a safety net in case the dimension guardrail didn't intercept
    if (isDimensionQuestion(message)) {
      console.log('STEP 5.5: DIMENSION POST-VALIDATION');
      console.log('-'.repeat(80));
      
      const validation = validateLLMResponseForDimensions(
        answer,
        message,
        dimensionGuardrailResult.lookupSuccessful
      );
      
      if (!validation.isValid && validation.sanitizedResponse) {
        console.log(`❌ LLM FABRICATION DETECTED - Replacing with safe fallback`);
        console.log(`   Original answer contained fabricated dimensions`);
        answer = validation.sanitizedResponse;
      } else {
        console.log(`✅ Response validated - no fabrication detected\n`);
      }
    }

    const duration = Date.now() - startTime;
    
    // Calculate token usage and cost
    const tokenCount = completion.usage?.total_tokens || 0;
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    // GPT-4.1-mini pricing: $0.15/1M input, $0.60/1M output
    const costUsd = (promptTokens * 0.00000015) + (completionTokens * 0.0000006);
    
    // Extract cited document IDs from chunks
    const citedDocumentIds = chunks
      .filter((chunk: UnitFirstChunk) => chunk.document_id)
      .map((chunk: UnitFirstChunk) => chunk.document_id)
      .filter((id: string, index: number, arr: string[]) => arr.indexOf(id) === index); // unique

    // STEP 6: LOG MESSAGE TO DATABASE
    console.log('STEP 6: LOGGING MESSAGE TO DATABASE');
    console.log('-'.repeat(80));
    
    try {
      // Note: house_id references homeowners.id, not units.id
      // Since we don't have a direct link, set to null and use user_id for unit context
      const houseId = null;
      const userId = unitDetails?.id || `anonymous-${developmentId}`;
      
      await db.execute(sql`
        INSERT INTO messages (
          tenant_id,
          development_id,
          house_id,
          user_id,
          sender,
          content,
          user_message,
          ai_message,
          source,
          token_count,
          cost_usd,
          latency_ms,
          cited_document_ids,
          metadata,
          created_at
        ) VALUES (
          ${tenantId}::uuid,
          ${developmentId}::uuid,
          ${houseId ? sql`${houseId}::uuid` : sql`NULL`},
          ${userId},
          'user',
          ${message},
          ${message},
          ${answer},
          'chat',
          ${tokenCount},
          ${costUsd},
          ${duration},
          ${citedDocumentIds.length > 0 ? sql`ARRAY[${sql.join(citedDocumentIds.map((id: string) => sql`${id}`), sql`, `)}]::text[]` : sql`NULL`},
          ${JSON.stringify({
            chunks_used: chunks.length,
            context_length: context.length,
            model: 'gpt-4.1-mini',
            unit_number: unitDetails?.unit_number || null,
            house_type: unitDetails?.house_type_code || null,
            source: profileSource,
            has_profile_data: !!profileContext,
            avg_chunk_score: avgChunkScore,
            rag_confidence: ragConfidence,
            answer_confidence: answerConf.confidence,
            tier_breakdown: tierBreakdown,
          })}::jsonb,
          NOW()
        )
      `);
      
      console.log(`✅ Message logged to database`);
      console.log(`   • Token count: ${tokenCount}`);
      console.log(`   • Cost: $${costUsd.toFixed(6)}`);
      console.log(`   • Latency: ${duration}ms`);
      console.log(`   • Cited docs: ${citedDocumentIds.length}`);
    } catch (logError) {
      console.error('⚠️  Failed to log message to database:', logError);
      logger.error('Message logging failed', {
        tenantId,
        developmentId,
        error: logError instanceof Error ? logError.message : 'Unknown error',
      });
    }
    
    // STEP 7: INCREMENT ANALYTICS COUNTER
    console.log('STEP 7: ANALYTICS INCREMENT');
    console.log('-'.repeat(80));
    
    try {
      await db.execute(sql`
        INSERT INTO analytics_events (
          tenant_id,
          development_id,
          event_type,
          event_data,
          created_at
        ) VALUES (
          ${tenantId}::uuid,
          ${developmentId}::uuid,
          'chat_message',
          ${JSON.stringify({
            unit_id: unitDetails?.id || null,
            house_type: unitDetails?.house_type_code || null,
            message_length: message.length,
            answer_length: answer.length,
            chunks_used: chunks.length,
            source: profileSource,
            rag_confidence: ragConfidence,
            answer_confidence: answerConf.confidence,
            cost_usd: costUsd,
            latency_ms: duration,
          })}::jsonb,
          NOW()
        )
      `);
      console.log(`✅ Analytics event recorded`);
    } catch (analyticsError) {
      console.log(`⚠️ Analytics logging failed (non-fatal): ${analyticsError instanceof Error ? analyticsError.message : 'Unknown'}`);
    }

    console.log('='.repeat(80));
    console.log('✅ CHAT REQUEST COMPLETED');
    console.log('='.repeat(80));
    console.log(`📊 Summary:`);
    console.log(`   • Chunks retrieved: ${chunks.length}`);
    console.log(`   • Context size: ${context.length} chars`);
    console.log(`   • Answer size: ${answer.length} chars`);
    console.log(`   • Total tokens: ${tokenCount}`);
    console.log(`   • Response time: ${duration}ms`);
    console.log(`   • Source: ${profileSource.toUpperCase()}`);
    console.log(`   • Profile data used: ${profileContext ? 'YES' : 'NO'}`);
    console.log('='.repeat(80));
    console.log('');

    logger.apiRequest('/api/chat', 'POST', 200, duration, {
      tenantId,
      developmentId,
      chunksUsed: chunks.length,
      answerLength: answer.length,
      tokenCount,
      costUsd,
    });

    return NextResponse.json({
      success: true,
      answer,
      chunksUsed: chunks.length,
      matched: chunkPreviews,
      source: profileSource,
      hasProfileData: !!profileContext,
    }, {
      headers: {
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Chat API Error', {
      route: '/api/chat',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
