import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { Unit, UnitType, DocumentSection } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChatRequest {
  message: string;
  userId?: string;
}

interface ChatResponse {
  success: boolean;
  answer?: string;
  floorPlanUrl?: string;
  unitType?: Partial<UnitType>;
  source: 'floor_plan' | 'vector_search' | 'fallback';
  chunksUsed?: number;
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
    /bedroom.*size/i,
    /living.*room.*size/i,
    /kitchen.*size/i,
    /total.*area/i,
    /room.*dimension/i,
  ];

  return measurementPatterns.some(pattern => pattern.test(messageLower));
}

async function getFloorPlanForUser(userId: string): Promise<{ unit: Unit | null; unitType: UnitType | null }> {
  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (unitError || !unit) {
    console.log('[Chat] No unit found for user:', userId);
    return { unit: null, unitType: null };
  }

  if (!unit.unit_type_id) {
    console.log('[Chat] Unit has no unit_type_id:', unit.id);
    return { unit, unitType: null };
  }

  const { data: unitType, error: typeError } = await supabase
    .from('unit_types')
    .select('*')
    .eq('id', unit.unit_type_id)
    .single();

  if (typeError || !unitType) {
    console.log('[Chat] No unit type found for id:', unit.unit_type_id);
    return { unit, unitType: null };
  }

  return { unit, unitType };
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

async function generateAnswer(query: string, context: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a helpful property assistant. Answer questions based on the provided context. 
If the context doesn't contain relevant information, say so honestly.
Keep answers concise and helpful.`,
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${query}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || "I couldn't generate a response.";
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, userId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Chat] HYBRID RETRIEVAL - Router Pattern');
    console.log('='.repeat(60));
    console.log(`Query: ${message}`);
    console.log(`UserId: ${userId || 'anonymous'}`);

    const isMeasurement = isMeasurementQuestion(message);
    console.log(`Is measurement question: ${isMeasurement}`);

    if (isMeasurement && userId) {
      console.log('[Chat] Step B: Fetching floor plan from structured data...');
      const { unit, unitType } = await getFloorPlanForUser(userId);

      if (unitType?.floor_plan_pdf_url) {
        console.log('[Chat] Found floor plan URL:', unitType.floor_plan_pdf_url);

        const response: ChatResponse = {
          success: true,
          answer: `Here is your floor plan for your ${unitType.type_name || 'home'}. This ${unitType.bedrooms || 0}-bedroom, ${unitType.bathrooms || 0}-bathroom home has a total area of ${unitType.total_area_sqm || 'N/A'} square meters.`,
          floorPlanUrl: unitType.floor_plan_pdf_url,
          unitType: {
            id: unitType.id,
            type_name: unitType.type_name,
            total_area_sqm: unitType.total_area_sqm,
            bedrooms: unitType.bedrooms,
            bathrooms: unitType.bathrooms,
          },
          source: 'floor_plan',
        };

        console.log('[Chat] Returning structured floor plan response');
        console.log('='.repeat(60) + '\n');

        return NextResponse.json(response);
      } else {
        console.log('[Chat] No floor plan found, falling through to vector search');
      }
    }

    console.log('[Chat] Step C: Performing vector search on document_sections...');

    let projectId: string | undefined;
    if (userId) {
      const { data: unit } = await supabase
        .from('units')
        .select('project_id')
        .eq('user_id', userId)
        .single();

      if (unit?.project_id) {
        projectId = unit.project_id;
        console.log('[Chat] Scoping search to project:', projectId);
      }
    }

    const chunks = await searchDocumentSections(message, projectId, 5);
    console.log(`[Chat] Found ${chunks.length} relevant document sections`);

    if (chunks.length === 0) {
      const response: ChatResponse = {
        success: true,
        answer: "I don't have specific information about that in the documents. Would you like to ask about something else, or should I connect you with support?",
        source: 'fallback',
        chunksUsed: 0,
      };

      console.log('[Chat] No relevant chunks found, returning fallback');
      console.log('='.repeat(60) + '\n');

      return NextResponse.json(response);
    }

    const context = chunks
      .map((chunk, i) => `[${i + 1}] ${chunk.section_title || 'Section'}: ${chunk.content}`)
      .join('\n\n');

    const answer = await generateAnswer(message, context);

    const response: ChatResponse = {
      success: true,
      answer,
      source: 'vector_search',
      chunksUsed: chunks.length,
    };

    console.log('[Chat] Generated answer from vector search');
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
