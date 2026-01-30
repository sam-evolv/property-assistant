// /api/super/assistant/test/route.ts
// Direct test that queries documents and calls OpenAI
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Supabase client for tables not in Drizzle schema and vector search RPC
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const body = await request.json();
    const { development_id, message, include_custom_qa } = body;

    console.log('[Test Assistant] Received request:', { development_id, message: message?.substring(0, 50) });

    if (!development_id || !message) {
      return NextResponse.json({ 
        error: 'development_id and message required',
        received: { development_id, hasMessage: !!message }
      }, { status: 400 });
    }

    // 1. Get development details using Drizzle (consistent with other APIs)
    let development: { id: string; name: string; system_instructions: string | null; address: string | null } | null = null;
    
    const [devById] = await db
      .select({
        id: developments.id,
        name: developments.name,
        system_instructions: developments.system_instructions,
        address: developments.address,
      })
      .from(developments)
      .where(eq(developments.id, development_id))
      .limit(1);

    if (devById) {
      development = devById;
    } else {
      // Try slug fallback
      const [devBySlug] = await db
        .select({
          id: developments.id,
          name: developments.name,
          system_instructions: developments.system_instructions,
          address: developments.address,
        })
        .from(developments)
        .where(eq(developments.slug, development_id))
        .limit(1);

      if (devBySlug) {
        development = devBySlug;
      }
    }

    if (!development) {
      // List available developments for debugging
      const allDevs = await db
        .select({ id: developments.id, name: developments.name, slug: developments.slug })
        .from(developments)
        .limit(10);
      
      console.log('[Test Assistant] Development not found. Available:', allDevs);
      
      return NextResponse.json({ 
        error: 'Development not found',
        searched_id: development_id,
        available_developments: allDevs
      }, { status: 404 });
    }

    console.log('[Test Assistant] Found development:', development.name);

    // 2. Get custom Q&As if enabled (via Supabase - not in Drizzle schema)
    let customQAContext = '';
    if (include_custom_qa !== false) {
      try {
        const { data: qas } = await supabaseAdmin
          .from('custom_qa')
          .select('question, answer')
          .eq('development_id', development.id)
          .eq('active', true);

        if (qas && qas.length > 0) {
          customQAContext = '\n\n## Custom Q&A (use these exact answers when questions match):\n' +
            qas.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n');
          console.log('[Test Assistant] Found', qas.length, 'custom Q&As');
        }
      } catch (qaError) {
        console.log('[Test Assistant] Custom Q&A query failed (table may not exist):', qaError);
      }
    }

    // 3. Get knowledge base (development-specific + platform-wide) via Supabase
    let knowledgeContext = '';
    try {
      const { data: knowledge } = await supabaseAdmin
        .from('knowledge_base')
        .select('title, content, category')
        .or(`development_id.eq.${development.id},development_id.is.null`)
        .eq('active', true);

      if (knowledge && knowledge.length > 0) {
        knowledgeContext = '\n\n## Additional Knowledge:\n' +
          knowledge.map((k: any) => `### ${k.title} (${k.category})\n${k.content}`).join('\n\n');
        console.log('[Test Assistant] Found', knowledge.length, 'knowledge items');
      }
    } catch (kbError) {
      console.log('[Test Assistant] Knowledge base query failed (table may not exist):', kbError);
    }

    // 4. Search for relevant document chunks using vector similarity (via Supabase RPC)
    let documentContext = '';
    try {
      // Generate embedding for the user's question
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: message,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Search for similar document chunks via Supabase RPC
      const { data: chunks, error: searchError } = await supabaseAdmin
        .rpc('match_document_sections', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: 5,
          p_development_id: development.id
        });

      if (!searchError && chunks && chunks.length > 0) {
        documentContext = '\n\n## Relevant Document Excerpts:\n' +
          chunks.map((chunk: any) => `---\n${chunk.content}\n---`).join('\n');
        console.log('[Test Assistant] Found', chunks.length, 'relevant document chunks');
      }
    } catch (embeddingError) {
      console.log('[Test Assistant] Vector search not available:', embeddingError);
    }

    // 5. Build system prompt
    const systemPrompt = `You are an AI assistant for ${development.name}, a residential development${development.address ? ` located at ${development.address}` : ''}.

You help homeowners with questions about their property, including warranty information, maintenance, documents, facilities, and general queries.

${development.system_instructions || ''}
${customQAContext}
${knowledgeContext}
${documentContext}

## Guidelines:
- Be helpful, friendly, and concise
- If a custom Q&A matches the user's question, use that exact answer
- If relevant document excerpts are provided, base your answer on them
- If you don't have specific information about something, say so honestly
- For complex issues, suggest contacting the developer or management company
- Keep responses focused and practical`;

    // 6. Call OpenAI
    console.log('[Test Assistant] Calling OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 1024,
      temperature: 0.7
    });

    const assistantResponse = response.choices[0]?.message?.content || 
      'I apologize, I could not generate a response.';

    console.log('[Test Assistant] Response generated successfully');

    return NextResponse.json({ 
      response: assistantResponse,
      debug: {
        developmentName: development.name,
        hasCustomQA: customQAContext.length > 0,
        hasKnowledge: knowledgeContext.length > 0,
        hasDocuments: documentContext.length > 0
      }
    });
  } catch (err) {
    console.error('[Test Assistant] Error:', err);
    return NextResponse.json({ 
      error: 'Failed to get response',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
