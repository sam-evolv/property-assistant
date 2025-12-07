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

    // STEP 2: Try match_document_sections RPC first, fallback to match_documents
    console.log('[Chat] Searching documents...');
    
    let matches: Array<{ id: string; content: string; metadata: Record<string, unknown>; similarity: number }> | null = null;
    
    // Try match_document_sections (for document_sections table)
    const { data: sectionsMatch, error: sectionsError } = await supabase.rpc('match_document_sections', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 5,
      filter_project_id: PROJECT_ID,
    });

    if (!sectionsError && sectionsMatch && sectionsMatch.length > 0) {
      console.log('[Chat] match_document_sections returned:', sectionsMatch.length);
      matches = sectionsMatch;
    } else {
      if (sectionsError) {
        console.log('[Chat] match_document_sections error:', sectionsError.message);
      }
      
      // Fallback: Try match_documents (might be configured for documents table)
      const { data: docsMatch, error: docsError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 5,
      });

      if (!docsError && docsMatch && docsMatch.length > 0) {
        console.log('[Chat] match_documents returned:', docsMatch.length);
        // Post-filter by project_id
        const matchIds = docsMatch.map((m: { id: string }) => m.id);
        const { data: filtered } = await supabase
          .from('document_sections')
          .select('id, content, metadata')
          .in('id', matchIds)
          .eq('project_id', PROJECT_ID);
        
        if (filtered && filtered.length > 0) {
          const simMap = new Map(docsMatch.map((m: { id: string; similarity: number }) => [m.id, m.similarity]));
          matches = filtered.map(s => ({
            id: s.id,
            content: s.content,
            metadata: s.metadata || {},
            similarity: (simMap.get(s.id) as number) || 0.5,
          }));
        }
      } else {
        if (docsError) console.log('[Chat] match_documents error:', docsError.message);
      }
    }

    // If RPC doesn't work, do a simple text search fallback
    if (!matches || matches.length === 0) {
      console.log('[Chat] RPC failed, trying text search fallback...');
      const keywords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);
      
      if (keywords.length > 0) {
        const { data: textMatches } = await supabase
          .from('document_sections')
          .select('id, content, metadata')
          .eq('project_id', PROJECT_ID)
          .ilike('content', `%${keywords[0]}%`)
          .limit(5);

        if (textMatches && textMatches.length > 0) {
          console.log('[Chat] Text search found:', textMatches.length);
          matches = textMatches.map(s => ({
            id: s.id,
            content: s.content,
            metadata: s.metadata || {},
            similarity: 0.5,
          }));
        }
      }
    }

    // Last resort: just get the first few chunks
    if (!matches || matches.length === 0) {
      console.log('[Chat] Falling back to first available chunks...');
      const { data: anyChunks } = await supabase
        .from('document_sections')
        .select('id, content, metadata')
        .eq('project_id', PROJECT_ID)
        .limit(3);

      if (anyChunks && anyChunks.length > 0) {
        console.log('[Chat] Using first', anyChunks.length, 'available chunks');
        matches = anyChunks.map(s => ({
          id: s.id,
          content: s.content,
          metadata: s.metadata || {},
          similarity: 0.3,
        }));
      }
    }

    console.log('[Chat] Final matches:', matches?.length || 0);

    // STEP 3: Build System Message
    let systemMessage: string;

    if (matches && matches.length > 0) {
      const referenceData = matches
        .map((m, i) => {
          const source = (m.metadata?.file_name || m.metadata?.source || 'Document') as string;
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

      console.log('[Chat] Context injected from', matches.length, 'documents');
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
      source: matches && matches.length > 0 ? 'vector_search' : 'no_context',
      chunksUsed: matches?.length || 0,
      documents: matches?.map(m => ({
        source: m.metadata?.file_name || m.metadata?.source,
        similarity: m.similarity,
      })) || [],
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
