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
  metadata: Record<string, unknown>;
  similarity: number;
  project_id?: string;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function searchDocuments(query: string): Promise<DocumentMatch[]> {
  try {
    console.log('[Chat] Generating embedding for query...');
    const queryEmbedding = await generateEmbedding(query);
    
    console.log('[Chat] Embedding dimensions:', queryEmbedding.length);
    console.log('[Chat] Filtering by PROJECT_ID:', PROJECT_ID);
    
    // Try RPC first with project_id filter
    const { data, error } = await supabase.rpc('match_documents_by_project', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 5,
      target_project_id: PROJECT_ID,
    });

    if (error) {
      // Fallback: Use regular match_documents then manually filter
      console.log('[Chat] Falling back to unfiltered RPC + post-filter...');
      
      const { data: allData, error: fallbackError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 20,
      });
      
      if (fallbackError) {
        console.error('[Chat] Vector search RPC error:', fallbackError.message);
        return [];
      }
      
      // Get the IDs and fetch project_id from document_sections
      const ids = (allData || []).map((m: { id: string }) => m.id);
      if (ids.length === 0) {
        console.log('[Chat] No matches found');
        return [];
      }
      
      // Fetch sections with project_id filter
      const { data: sections, error: sectionsError } = await supabase
        .from('document_sections')
        .select('id, content, metadata, project_id')
        .in('id', ids)
        .eq('project_id', PROJECT_ID);
      
      if (sectionsError) {
        console.error('[Chat] Sections fetch error:', sectionsError.message);
        return [];
      }
      
      // Map back similarity scores
      const similarityMap = new Map<string, number>((allData || []).map((m: { id: string; similarity: number }) => [m.id, m.similarity]));
      const results: DocumentMatch[] = (sections || []).map((s: { id: string; content: string; metadata: Record<string, unknown>; project_id: string }) => ({
        id: s.id,
        content: s.content,
        metadata: s.metadata || {},
        similarity: similarityMap.get(s.id) ?? 0,
        project_id: s.project_id,
      }));
      
      // Sort by similarity
      results.sort((a, b) => b.similarity - a.similarity);
      
      console.log(`[Chat] RAG RESULTS: ${results.length} chunks from Launch development`);
      results.slice(0, 5).forEach((match, i) => {
        console.log(`[Chat] Match ${i + 1}:`, {
          similarity: match.similarity?.toFixed(3),
          source: match.metadata?.file_name || match.metadata?.source,
          contentPreview: match.content?.slice(0, 100),
        });
      });
      
      return results.slice(0, 5);
    }

    console.log(`[Chat] RAG RESULTS: Found ${data?.length || 0} matching document chunks`);
    
    if (data && data.length > 0) {
      data.forEach((match: DocumentMatch, i: number) => {
        console.log(`[Chat] Match ${i + 1}:`, {
          similarity: match.similarity?.toFixed(3),
          source: match.metadata?.file_name || match.metadata?.source,
          contentPreview: match.content?.slice(0, 100),
        });
      });
    }
    
    return data || [];
  } catch (err) {
    console.error('[Chat] searchDocuments error:', err);
    return [];
  }
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
    console.log(`[Chat] User query: "${message}"`);

    // STEP 1: Search for relevant documents using vector similarity
    const matches = await searchDocuments(message);

    // STEP 2: Build context from matches
    let contextBlock = '';
    if (matches.length > 0) {
      const facts = matches.map((match, i) => {
        const source = match.metadata?.file_name || match.metadata?.source || 'Document';
        return `[${i + 1}] From "${source}":\n${match.content}`;
      }).join('\n\n');
      
      contextBlock = `CONTEXT FROM DOCUMENTS:\n${facts}`;
      console.log('[Chat] Context built from', matches.length, 'document chunks');
    } else {
      console.log('[Chat] WARNING: No matching documents found in vector search');
    }

    // STEP 3: Build system prompt with injected context
    const systemPrompt = contextBlock
      ? `You are a helpful property assistant for the Launch development.

${contextBlock}

INSTRUCTIONS:
1. Answer the user's question using ONLY the context above.
2. If the context contains the answer, provide it clearly and mention which document it came from.
3. If the context does NOT contain the answer, honestly say "I don't have information about that in the uploaded documents."
4. Do NOT make up information. Only use the facts provided above.
5. Be concise, friendly, and helpful.`
      : `You are a helpful property assistant for the Launch development.

The user is asking a question but no relevant documents were found in the knowledge base.
Politely let them know you don't have information about their specific question in the uploaded documents.
Suggest they upload relevant documents or ask about topics that might be covered in existing documentation.`;

    // STEP 4: Generate response with GPT-4o-mini
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
    console.log('[Chat] Answer preview:', answer.slice(0, 150));
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
