import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { Unit, UnitType, DocumentSection } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

// CRITICAL: Use Service Role Key to bypass RLS and always fetch unit data
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChatRequest {
  message: string;
  userId?: string;
  unitId?: string;
  houseId?: string;
}

interface ChatResponse {
  success: boolean;
  answer?: string;
  floorPlanUrl?: string;
  unitType?: Partial<UnitType>;
  source: 'floor_plan' | 'vector_search' | 'unit_context' | 'fallback';
  chunksUsed?: number;
}

interface UnitContext {
  address: string;
  purchaserName: string;
  houseType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  totalArea: number | null;
  projectId: string | null;
  floorPlanUrl: string | null;
  specs: Record<string, any> | null;
}

// Fetch rich unit data from Supabase
async function getUnitContext(unitId: string): Promise<UnitContext | null> {
  console.log('[Chat] Fetching unit context for:', unitId);
  
  const { data: unit, error } = await supabase
    .from('units')
    .select(`
      id,
      address,
      purchaser_name,
      project_id,
      unit_types (
        name,
        specification_json,
        floor_plan_pdf_url
      )
    `)
    .eq('id', unitId)
    .single();

  if (error || !unit) {
    console.log('[Chat] No unit found:', error?.message);
    return null;
  }

  // Handle unit_types (may be array or object)
  const unitType = Array.isArray(unit.unit_types) ? unit.unit_types[0] : unit.unit_types;
  const specs = unitType?.specification_json || {};

  const context: UnitContext = {
    address: unit.address || 'Not specified',
    purchaserName: unit.purchaser_name || 'Homeowner',
    houseType: unitType?.name || 'Standard',
    bedrooms: specs.bedrooms || specs.Bedrooms || null,
    bathrooms: specs.bathrooms || specs.Bathrooms || null,
    propertyType: specs.property_type || specs.propertyType || null,
    totalArea: specs.total_area_sqm || specs.totalArea || null,
    projectId: unit.project_id,
    floorPlanUrl: unitType?.floor_plan_pdf_url || null,
    specs: specs,
  };

  console.log('[Chat] Unit context loaded:', {
    address: context.address,
    purchaser: context.purchaserName,
    type: context.houseType,
    bedrooms: context.bedrooms,
    bathrooms: context.bathrooms,
  });

  return context;
}

// Build system context from unit data
function buildUnitSystemContext(context: UnitContext): string {
  const lines = [
    '=== CURRENT UNIT CONTEXT (AUTHORITATIVE DATA) ===',
    `Address: ${context.address}`,
    `Owner: ${context.purchaserName}`,
    `House Type: ${context.houseType}`,
  ];

  if (context.bedrooms !== null) {
    lines.push(`Bedrooms: ${context.bedrooms}`);
  }
  if (context.bathrooms !== null) {
    lines.push(`Bathrooms: ${context.bathrooms}`);
  }
  if (context.propertyType) {
    lines.push(`Property Type: ${context.propertyType}`);
  }
  if (context.totalArea) {
    lines.push(`Total Area: ${context.totalArea} sqm`);
  }

  // Include any additional specs
  if (context.specs && Object.keys(context.specs).length > 0) {
    lines.push('\nAdditional Specifications:');
    for (const [key, value] of Object.entries(context.specs)) {
      if (value && !['bedrooms', 'bathrooms', 'property_type', 'total_area_sqm'].includes(key.toLowerCase())) {
        lines.push(`- ${key}: ${value}`);
      }
    }
  }

  lines.push('\n=== INSTRUCTIONS ===');
  lines.push('ALWAYS use the above unit context data to answer questions about this home.');
  lines.push('This data is authoritative - do not say "I don\'t know" if the answer is in the context above.');

  return lines.join('\n');
}

function isMeasurementQuestion(message: string): boolean {
  const messageLower = message.toLowerCase();
  const measurementPatterns = [
    /floor\s*plan/i,
    /measurement/i,
    /dimension/i,
    /size/i,
    /how\s+big/i,
    /square\s*(feet|footage|meters?|metres?|m)/i,
    /sqm|sqft|m²|ft²/i,
    /area/i,
    /layout/i,
    /bedroom/i,
    /bathroom/i,
    /living.*room/i,
    /kitchen/i,
    /how\s+many/i,
  ];

  return measurementPatterns.some(pattern => pattern.test(messageLower));
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function searchDocumentSections(
  query: string,
  projectId?: string,
  limit: number = 5
): Promise<DocumentSection[]> {
  const embedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc('match_document_sections', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
    filter_project_id: projectId || null,
  });

  if (error) {
    console.error('[Chat] Vector search error:', error);
    return [];
  }

  return data || [];
}

async function generateAnswer(query: string, unitContext: string, documentContext: string): Promise<string> {
  const systemPrompt = `You are a helpful property assistant for homeowners.

${unitContext}

Answer questions helpfully and accurately using the unit data and any document context provided.
If asked about bedrooms, bathrooms, house type, or address - use the UNIT CONTEXT above.
Keep answers concise, friendly, and helpful.`;

  const userPrompt = documentContext 
    ? `Document Context:\n${documentContext}\n\nUser Question: ${query}`
    : `User Question: ${query}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || "I couldn't generate a response.";
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, userId, unitId, houseId } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Determine the unit ID from various sources
    const resolvedUnitId = unitId || houseId || userId;

    console.log('\n' + '='.repeat(60));
    console.log('[Chat] CONTEXT-AWARE CHAT');
    console.log('='.repeat(60));
    console.log(`Query: ${message}`);
    console.log(`Unit ID: ${resolvedUnitId || 'none'}`);

    // Step 1: Fetch rich unit context from Supabase
    let unitContext: UnitContext | null = null;
    let unitSystemContext = '';

    if (resolvedUnitId) {
      unitContext = await getUnitContext(resolvedUnitId);
      if (unitContext) {
        unitSystemContext = buildUnitSystemContext(unitContext);
        console.log('[Chat] Unit context loaded successfully');
      }
    }

    // Step 2: Check if this is a direct unit question (bedrooms, bathrooms, etc.)
    const isMeasurement = isMeasurementQuestion(message);
    
    if (isMeasurement && unitContext) {
      console.log('[Chat] Measurement question - answering from unit context');
      
      // If we have a floor plan, include it
      if (unitContext.floorPlanUrl) {
        const response: ChatResponse = {
          success: true,
          answer: await generateAnswer(message, unitSystemContext, ''),
          floorPlanUrl: unitContext.floorPlanUrl,
          source: 'unit_context',
        };
        console.log('='.repeat(60) + '\n');
        return NextResponse.json(response);
      }

      // Answer from context without floor plan
      const answer = await generateAnswer(message, unitSystemContext, '');
      const response: ChatResponse = {
        success: true,
        answer,
        source: 'unit_context',
      };
      console.log('='.repeat(60) + '\n');
      return NextResponse.json(response);
    }

    // Step 3: Perform vector search for document-based questions
    console.log('[Chat] Performing vector search on document_sections...');

    const projectId = unitContext?.projectId || undefined;
    if (projectId) {
      console.log('[Chat] Scoping search to project:', projectId);
    }

    const chunks = await searchDocumentSections(message, projectId, 5);
    console.log(`[Chat] Found ${chunks.length} relevant document sections`);

    // Build document context
    const documentContext = chunks.length > 0
      ? chunks.map((chunk, i) => `[${i + 1}] ${chunk.section_title || 'Section'}: ${chunk.content}`).join('\n\n')
      : '';

    // Generate answer with both unit context and document context
    const answer = await generateAnswer(message, unitSystemContext, documentContext);

    const response: ChatResponse = {
      success: true,
      answer,
      source: chunks.length > 0 ? 'vector_search' : (unitContext ? 'unit_context' : 'fallback'),
      chunksUsed: chunks.length,
    };

    console.log('[Chat] Generated answer');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      { status: 500 }
    );
  }
}
