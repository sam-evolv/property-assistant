import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { db } from '@openhouse/db';
import { messages, units } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { extractQuestionTopic } from '@/lib/question-topic-extractor';
import { findDrawingForQuestion, ResolvedDrawing } from '@/lib/drawing-resolver';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
const DEFAULT_DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
const MAX_CHUNKS = 20; // Limit context to top 20 most relevant chunks
const MAX_CONTEXT_CHARS = 80000; // Max characters in context (~20k tokens)

// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(request: NextRequest) {
  console.log('\n============================================================');
  console.log('[Chat] RAG CHAT API - SEMANTIC SEARCH MODE');
  console.log('[Chat] PROJECT_ID:', PROJECT_ID);
  console.log('============================================================');

  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, unitUid: clientUnitUid, userId } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
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

    // STEP 1: Generate embedding for the user's question
    console.log('[Chat] Generating query embedding...');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      dimensions: 1536,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('[Chat] Query embedding generated');

    // STEP 2: Semantic search using cosine similarity on ALL chunks
    // Fetch ALL chunks with embeddings for proper semantic search
    console.log('[Chat] Loading all document chunks with embeddings...');
    const { data: allChunks, error: fetchError } = await supabase
      .from('document_sections')
      .select('id, content, metadata, embedding')
      .eq('project_id', PROJECT_ID);

    if (fetchError) {
      console.error('[Chat] Error fetching chunks:', fetchError.message);
      throw new Error('Failed to load documents');
    }

    console.log('[Chat] Loaded', allChunks?.length || 0, 'total chunks');

    // Calculate similarity scores for ALL chunks
    let chunks: any[] = [];
    if (allChunks && allChunks.length > 0) {
      console.log('[Chat] Computing semantic similarity scores...');
      
      const scoredChunks = allChunks.map(chunk => {
        // Semantic similarity using embeddings
        let similarity = 0;
        if (chunk.embedding && Array.isArray(chunk.embedding)) {
          similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
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
      
      // Take top chunks that fit within context limit
      let totalChars = 0;
      for (const chunk of scoredChunks) {
        if (chunks.length >= MAX_CHUNKS) break;
        if (totalChars + chunk.content.length > MAX_CONTEXT_CHARS) break;
        chunks.push(chunk);
        totalChars += chunk.content.length;
      }
      
      console.log('[Chat] Selected', chunks.length, 'most relevant chunks');
      console.log('[Chat] Top chunk scores:', chunks.slice(0, 3).map(c => ({
        score: c.score.toFixed(3),
        similarity: c.similarity.toFixed(3),
        source: c.metadata?.file_name || 'unknown'
      })));
    }

    // STEP 3: Build System Message with relevant context only
    let systemMessage: string;

    if (chunks && chunks.length > 0) {
      const referenceData = chunks
        .map((chunk: any) => chunk.content)
        .join('\n---\n');

      const sources = Array.from(new Set(chunks.map((c: any) => c.metadata?.file_name || c.metadata?.source || 'Document')));

      systemMessage = `You are an expert AI Assistant for OpenHouse property information.
Below is relevant project documentation retrieved from: ${sources.join(', ')}

--- BEGIN REFERENCE DATA ---
${referenceData}
--- END REFERENCE DATA ---

INSTRUCTIONS:
1. Use ONLY the Reference Data above to answer the user's question.
2. If the Reference Data contains the answer, state it clearly and specifically.
3. When asked about a specific item (e.g., "Staircase", "Kitchen", "Doors", "Windows", "Heating"), 
   search through ALL the text above for relevant sections.
4. Be thorough - the answer may be in any part of the document.
5. If the answer is NOT in the data, say "I don't have that specific detail in the uploaded documents."
6. Be concise but complete in your answer.

CRITICAL - ROOM DIMENSIONS:
- NEVER provide specific room dimensions, measurements, or sizes (in meters, feet, or any unit).
- If asked about room sizes, dimensions, floor area, or measurements, respond with:
  "I've attached the floor plan for your house type below. Please check the drawing for accurate room dimensions."
- Do NOT quote any measurements from the documents - always direct users to check the official drawings themselves.
- This is a liability requirement - we cannot guarantee text-extracted measurements are accurate.`;

      console.log('[Chat] Context loaded:', referenceData.length, 'chars from', chunks.length, 'chunks');
    } else {
      systemMessage = `You are a helpful property assistant. No documents have been uploaded yet. Let the user know they need to upload project documents first.`;
      console.log('[Chat] No relevant documents found for this query');
    }

    // STEP 3: Generate Response
    console.log('[Chat] Generating response with GPT-4o-mini...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    let answer = response.choices[0]?.message?.content || "I couldn't generate a response.";
    const latencyMs = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || 0;
    const costUsd = (tokensUsed / 1000) * 0.00015;

    console.log('[Chat] Answer:', answer.slice(0, 100) + '...');
    console.log('[Chat] Latency:', latencyMs, 'ms, Tokens:', tokensUsed);

    const questionTopic = await extractQuestionTopic(message);
    console.log('[Chat] Question topic:', questionTopic);

    let drawing: ResolvedDrawing | null = null;
    let drawingExplanation = '';
    
    if (validatedUnitUid) {
      try {
        console.log('[Chat] Checking for relevant drawings...');
        const drawingResult = await findDrawingForQuestion(validatedUnitUid, questionTopic);
        if (drawingResult.found && drawingResult.drawing) {
          drawing = drawingResult.drawing;
          drawingExplanation = drawingResult.explanation;
          console.log('[Chat] Found drawing:', drawing.fileName, 'Type:', drawing.drawingType);
        }
      } catch (drawingError) {
        console.error('[Chat] Error finding drawing:', drawingError);
      }
    }
    
    // Server-side enforcement: If a room_sizes drawing is attached, 
    // ensure the answer doesn't contain specific measurements (liability protection)
    const isDimensionQuestion = questionTopic === 'room_sizes' || 
      /\b(dimension|size|measurement|square\s*(feet|meters|m2|ft2)|how\s*(big|large)|floor\s*area)\b/i.test(message);
    
    if (isDimensionQuestion && drawing && drawing.drawingType === 'room_sizes') {
      // Override any AI response that might contain measurements
      answer = "I've attached the floor plan for your house type below. Please check the drawing for accurate room dimensions - this ensures you have the correct official measurements.";
      console.log('[Chat] Dimension question detected - enforced floor plan response for liability');
    }

    try {
      await db.insert(messages).values({
        tenant_id: DEFAULT_TENANT_ID,
        development_id: DEFAULT_DEVELOPMENT_ID,
        user_id: userId || validatedUnitUid || 'anonymous',
        content: message,
        user_message: message,
        ai_message: answer,
        question_topic: questionTopic,
        sender: 'conversation',
        source: 'purchaser_portal',
        token_count: tokensUsed,
        cost_usd: String(costUsd),
        latency_ms: latencyMs,
        metadata: {
          unitUid: validatedUnitUid || null,
          chunksUsed: chunks?.length || 0,
          model: 'gpt-4o-mini',
          token_cost: costUsd,
          latency_ms: latencyMs,
        },
      });
      console.log('[Chat] Message saved to database');
    } catch (dbError) {
      console.error('[Chat] Failed to save message:', dbError);
    }

    console.log('============================================================\n');

    const responseData: any = {
      success: true,
      answer,
      source: chunks && chunks.length > 0 ? 'semantic_search' : 'no_documents',
      chunksUsed: chunks?.length || 0,
      documents: Array.from(new Set(chunks?.map((c: any) => c.metadata?.file_name || c.metadata?.source) || [])),
    };

    if (drawing) {
      responseData.drawing = {
        fileName: drawing.fileName,
        drawingType: drawing.drawingType,
        drawingDescription: drawing.drawingDescription,
        houseTypeCode: drawing.houseTypeCode,
        previewUrl: drawing.signedUrl,
        downloadUrl: drawing.downloadUrl,
        explanation: drawingExplanation,
      };
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
