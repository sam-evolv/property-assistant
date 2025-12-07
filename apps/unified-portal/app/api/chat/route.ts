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

interface DocumentMatch {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
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
    console.log('[Chat] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(query);
    
    // Call match_documents RPC
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
    });

    if (error) {
      console.error('[Chat] RPC error:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[Chat] No matches found');
      return [];
    }

    // Filter by project_id (post-filter since RPC doesn't filter by project)
    const matchIds = data.map((m: { id: string }) => m.id);
    
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id, content, metadata, project_id')
      .in('id', matchIds)
      .eq('project_id', PROJECT_ID);

    if (sectionsError) {
      console.error('[Chat] Sections query error:', sectionsError.message);
      return [];
    }

    // Build similarity map
    const similarityMap = new Map<string, number>();
    for (const m of data) {
      similarityMap.set(m.id, m.similarity);
    }

    // Map results with similarity scores
    const results: DocumentMatch[] = (sections || []).map((s: { id: string; content: string; metadata: Record<string, unknown> }) => ({
      id: s.id,
      content: s.content,
      metadata: s.metadata || {},
      similarity: similarityMap.get(s.id) || 0,
    }));

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    console.log(`[Chat] Found ${results.length} relevant chunks from project`);
    results.forEach((m, i) => {
      console.log(`[Chat] Match ${i + 1}: similarity=${m.similarity.toFixed(3)}, source=${m.metadata?.file_name || 'unknown'}`);
    });

    return results;
  } catch (err) {
    console.error('[Chat] Search error:', err);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    console.log('\n' + '='.repeat(60));
    console.log('[Chat] RAG CHAT REQUEST');
    console.log('='.repeat(60));
    console.log(`[Chat] Query: "${message}"`);

    // STEP 1: Search for relevant documents
    const matches = await searchDocuments(message);

    // STEP 2: Build context block
    let referenceData = '';
    if (matches.length > 0) {
      const facts = matches.map((m, i) => {
        const source = m.metadata?.file_name || m.metadata?.source || 'Document';
        return `[Source ${i + 1}: ${source}]\n${m.content}`;
      }).join('\n\n---\n\n');
      
      referenceData = facts;
      console.log(`[Chat] Context: ${matches.length} chunks, ${referenceData.length} chars`);
    } else {
      console.log('[Chat] No matching documents found');
    }

    // STEP 3: Build system message with RAG injection
    let systemMessage: string;
    
    if (referenceData) {
      systemMessage = `REFERENCE DATA:
${referenceData}

INSTRUCTIONS:
- Answer the user's question using ONLY the reference data above.
- If the reference data contains the answer, provide it clearly and cite which source it came from.
- If the reference data does NOT contain the answer, say "I don't have information about that in the uploaded documents."
- Do NOT make up information or use knowledge outside the reference data.
- Be concise and helpful.`;
    } else {
      systemMessage = `You are a helpful property assistant. Unfortunately, no relevant documents were found in the knowledge base for this question. Let the user know politely that you don't have information about their specific question and suggest they upload relevant documents.`;
    }

    // STEP 4: Generate response with OpenAI
    console.log('[Chat] Calling GPT-4o-mini...');
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

    console.log('[Chat] Response:', answer.slice(0, 150) + '...');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      answer,
      source: matches.length > 0 ? 'vector_search' : 'no_context',
      chunksUsed: matches.length,
      documents: matches.map(m => ({
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
