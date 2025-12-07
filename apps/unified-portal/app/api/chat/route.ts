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

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

export async function POST(request: NextRequest) {
  console.log('\n============================================================');
  console.log('[Chat] RAG CHAT API');
  console.log('[Chat] PROJECT_ID:', PROJECT_ID);
  console.log('============================================================');

  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    console.log('[Chat] User query:', message);

    // STEP 1: Embed User Query
    console.log('[Chat] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(message);

    // STEP 2: Search with match_documents RPC
    console.log('[Chat] Searching documents...');
    const { data: matches, error: rpcError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
    });

    if (rpcError) {
      console.error('[Chat] RPC error:', rpcError.message);
    }

    // Filter by PROJECT_ID (post-filter since RPC doesn't support it)
    let relevantMatches: Array<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }> = [];
    
    if (matches && matches.length > 0) {
      const matchIds = matches.map((m: { id: string }) => m.id);
      
      const { data: sections } = await supabase
        .from('document_sections')
        .select('id, content, metadata, project_id')
        .in('id', matchIds)
        .eq('project_id', PROJECT_ID);

      if (sections) {
        const similarityMap = new Map(matches.map((m: { id: string; similarity: number }) => [m.id, m.similarity]));
        relevantMatches = sections.map(s => ({
          id: s.id,
          content: s.content,
          metadata: s.metadata || {},
          similarity: (similarityMap.get(s.id) as number) || 0,
        }));
        relevantMatches.sort((a, b) => b.similarity - a.similarity);
      }
    }

    console.log('[Chat] Relevant matches:', relevantMatches.length);

    // STEP 3: Inject Reference Data
    let systemMessage: string;

    if (relevantMatches.length > 0) {
      const referenceData = relevantMatches
        .map((m, i) => {
          const source = m.metadata?.file_name || m.metadata?.source || 'Document';
          return `[${i + 1}] Source: ${source}\n${m.content}`;
        })
        .join('\n\n---\n\n');

      systemMessage = `REFERENCE DATA:
${referenceData}

INSTRUCTIONS:
- Answer the user's question using ONLY the reference data above.
- If the answer is in the reference data, cite which source it came from.
- If the answer is NOT in the reference data, say "I don't have information about that in the uploaded documents."
- Do NOT make up information.
- Be concise and helpful.`;

      console.log('[Chat] Context injected from', relevantMatches.length, 'documents');
    } else {
      systemMessage = `You are a helpful property assistant. No relevant documents were found for this question. Let the user know politely that you don't have information about their specific question in the uploaded documents.`;
      console.log('[Chat] No matching documents found');
    }

    // STEP 4: Generate Response
    console.log('[Chat] Generating response...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content || "I couldn't generate a response.";

    console.log('[Chat] Answer:', answer.slice(0, 100) + '...');
    console.log('============================================================\n');

    return NextResponse.json({
      success: true,
      answer,
      source: relevantMatches.length > 0 ? 'vector_search' : 'no_context',
      chunksUsed: relevantMatches.length,
      documents: relevantMatches.map(m => ({
        source: m.metadata?.file_name || m.metadata?.source,
        similarity: m.similarity,
      })),
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
