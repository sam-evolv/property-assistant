import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { db } from '@openhouse/db';
import { messages, units } from '@openhouse/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { extractQuestionTopic } from '@/lib/question-topic-extractor';
import { findDrawingForQuestion, ResolvedDrawing } from '@/lib/drawing-resolver';
import { validateQRToken } from '@openhouse/api/qr-tokens';

const CONVERSATION_HISTORY_LIMIT = 4; // Load last 4 exchanges for context

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

    // STEP 0: Load conversation history for context-aware responses
    // Use validated unit UID (from QR token) as the primary user identifier for session isolation
    const conversationUserId = validatedUnitUid || userId || '';
    const conversationHistory = await loadConversationHistory(conversationUserId, DEFAULT_TENANT_ID, DEFAULT_DEVELOPMENT_ID);
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
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchQuery,
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
    
    // Check if this is the first message in the conversation (for greeting logic)
    const isFirstMessage = conversationHistory.length === 0;

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
- If you're unsure about something, say so honestly and suggest next steps

GREETING BEHAVIOUR:
${isFirstMessage ? `- This is the homeowner's first message. Start with a brief, warm welcome (one sentence max), then answer their question directly.` : `- This is a follow-up message. Do NOT repeat any welcome or greeting - just answer the question directly.`}

ANSWERING STYLE:
- Get straight to the point - answer the question first, then add helpful context if needed
- Only use bullet points or headings when they genuinely improve clarity, not by default
- Reference the homeowner's house type or development context when it's clearly useful, but don't repeat their full address every time
- If information isn't in the documents, be upfront: "I don't have that specific detail to hand, but you could try..."

REFERENCE DATA (from: ${sources.join(', ')}):
--- BEGIN REFERENCE DATA ---
${referenceData}
--- END REFERENCE DATA ---

CRITICAL - ROOM DIMENSIONS (LIABILITY REQUIREMENT):
- NEVER provide specific room dimensions, measurements, or sizes (in metres, feet, or any unit)
- If asked about room sizes, dimensions, floor area, or measurements, respond with:
  "I've popped the floor plan below for you - that'll have the accurate room dimensions."
- Do NOT quote any measurements from the documents - always direct users to check the official drawings themselves`;

      console.log('[Chat] Context loaded:', referenceData.length, 'chars from', chunks.length, 'chunks');
    } else {
      systemMessage = `You are a friendly on-site concierge for a residential development. Unfortunately, there are no documents uploaded yet for this development. Let the homeowner know kindly that the property information hasn't been set up yet, and suggest they contact the development team if they need help.`;
      console.log('[Chat] No relevant documents found for this query');
    }

    // STEP 4: Generate Response with conversation history for context
    console.log('[Chat] Generating response with GPT-4o-mini...');
    
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
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
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
      // Use the SAME conversationUserId for persistence as was used for history loading
      // This ensures history loading and saving use consistent identifiers
      await db.insert(messages).values({
        tenant_id: DEFAULT_TENANT_ID,
        development_id: DEFAULT_DEVELOPMENT_ID,
        user_id: conversationUserId || 'anonymous',
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
          userId: userId || null,
          chunksUsed: chunks?.length || 0,
          model: 'gpt-4o-mini',
          token_cost: costUsd,
          latency_ms: latencyMs,
        },
      });
      console.log('[Chat] Message saved to database for user:', conversationUserId || 'anonymous');
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
