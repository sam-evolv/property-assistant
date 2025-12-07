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

export async function POST(request: NextRequest) {
  console.log('\n============================================================');
  console.log('[Chat] RAG CHAT API - FULL CONTEXT MODE');
  console.log('[Chat] PROJECT_ID:', PROJECT_ID);
  console.log('============================================================');

  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    console.log('🔍 Search Query:', message);

    // STEP 1: Load ALL chunks for this project (small dataset optimization)
    console.log('[Chat] Loading all document chunks...');
    const { data: allChunks, error: chunksError } = await supabase
      .from('document_sections')
      .select('id, content, metadata')
      .eq('project_id', PROJECT_ID)
      .order('id');

    if (chunksError) {
      console.error('[Chat] Error loading chunks:', chunksError.message);
      throw new Error('Failed to load documents');
    }

    console.log('✅ Loaded', allChunks?.length || 0, 'chunks');

    // STEP 2: Build System Message with ALL context
    let systemMessage: string;

    if (allChunks && allChunks.length > 0) {
      const referenceData = allChunks
        .map((chunk) => chunk.content)
        .join('\n---\n');

      const sources = Array.from(new Set(allChunks.map(c => c.metadata?.file_name || c.metadata?.source || 'Document')));

      systemMessage = `You are an expert AI Assistant for OpenHouse property information.
Below is the COMPLETE project documentation retrieved from: ${sources.join(', ')}

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
6. Be concise but complete in your answer.`;

      console.log('[Chat] Full context loaded:', referenceData.length, 'chars from', allChunks.length, 'chunks');
    } else {
      systemMessage = `You are a helpful property assistant. No documents have been uploaded yet. Let the user know they need to upload project documents first.`;
      console.log('[Chat] No documents found for this project');
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

    const answer = response.choices[0]?.message?.content || "I couldn't generate a response.";

    console.log('[Chat] Answer:', answer.slice(0, 100) + '...');
    console.log('============================================================\n');

    return NextResponse.json({
      success: true,
      answer,
      source: allChunks && allChunks.length > 0 ? 'full_context' : 'no_documents',
      chunksUsed: allChunks?.length || 0,
      documents: Array.from(new Set(allChunks?.map(c => c.metadata?.file_name || c.metadata?.source) || [])),
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
