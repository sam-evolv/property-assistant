import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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

interface ChatRequest {
  message: string;
  userId?: string;
  unitId?: string;
  houseId?: string;
}

interface DocumentMatch {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function searchDocuments(query: string): Promise<DocumentMatch[]> {
  console.log('[Chat] Generating embedding for query...');
  const queryEmbedding = await generateEmbedding(query);
  
  console.log('[Chat] Calling match_documents RPC...');
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  if (error) {
    console.error('[Chat] Vector search error:', error);
    return [];
  }

  console.log(`[Chat] Found ${data?.length || 0} matching documents`);
  return data || [];
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Chat] RAG CHAT WITH VECTOR SEARCH');
    console.log('='.repeat(60));
    console.log(`Query: ${message}`);

    // Step 1: Embed the question and search for relevant documents
    const matches = await searchDocuments(message);

    // Step 2: Build context from matches
    let contextBlock = '';
    if (matches.length > 0) {
      const facts = matches.map((match, i) => {
        const source = match.metadata?.file_name || match.metadata?.source || 'Document';
        return `[${i + 1}] From "${source}":\n${match.content}`;
      }).join('\n\n');
      
      contextBlock = `FACTS FROM DOCUMENTS:\n${facts}`;
      console.log('[Chat] Context block created from', matches.length, 'documents');
    } else {
      console.log('[Chat] No matching documents found');
    }

    // Step 3: Build system prompt with context
    const systemPrompt = contextBlock
      ? `You are a helpful property assistant for the Launch development.

${contextBlock}

INSTRUCTIONS:
1. Answer the user's question using ONLY the facts above.
2. If the facts contain the answer, provide it clearly and cite which document it came from.
3. If the facts do not contain the answer, say "I don't have information about that in the uploaded documents."
4. Do NOT make up information. Only use the facts provided above.
5. Be concise, friendly, and helpful.`
      : `You are a helpful property assistant for the Launch development.

The user is asking a question but no relevant documents were found.
Politely let them know you don't have information about their question in the uploaded documents.
Suggest they ask about topics covered in the property documentation.`;

    // Step 4: Generate response
    console.log('[Chat] Generating AI response...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content || "I couldn't generate a response.";

    console.log('[Chat] Response generated successfully');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      answer,
      source: matches.length > 0 ? 'vector_search' : 'fallback',
      chunksUsed: matches.length,
      documents: matches.map(m => ({
        source: m.metadata?.file_name || m.metadata?.source,
        similarity: m.similarity,
      })),
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      { status: 500 }
    );
  }
}
