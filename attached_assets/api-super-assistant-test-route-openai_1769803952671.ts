// /api/super/assistant/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { development_id, message, include_custom_qa } = body;

    if (!development_id || !message) {
      return NextResponse.json({ error: 'development_id and message required' }, { status: 400 });
    }

    // Fetch development details
    const { data: development } = await supabaseAdmin
      .from('developments')
      .select('name, system_instructions')
      .eq('id', development_id)
      .single();

    // Fetch custom Q&As if enabled
    let customQAContext = '';
    if (include_custom_qa) {
      const { data: qas } = await supabaseAdmin
        .from('custom_qa')
        .select('question, answer')
        .eq('development_id', development_id)
        .eq('active', true);

      if (qas && qas.length > 0) {
        customQAContext = '\n\nCustom Q&A pairs for this development (use these exact answers when questions match):\n' +
          qas.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n');
      }
    }

    // Fetch knowledge base items
    const { data: knowledge } = await supabaseAdmin
      .from('knowledge_base')
      .select('title, content')
      .eq('development_id', development_id);

    let knowledgeContext = '';
    if (knowledge && knowledge.length > 0) {
      knowledgeContext = '\n\nAdditional knowledge for this development:\n' +
        knowledge.map(k => `${k.title}: ${k.content}`).join('\n\n');
    }

    // Build system prompt
    const systemPrompt = `You are an AI assistant for ${development?.name || 'a residential development'}. 
You help homeowners with questions about their property, warranty, maintenance, documents, and general queries.

${development?.system_instructions || ''}
${customQAContext}
${knowledgeContext}

Guidelines:
- Be helpful, friendly, and concise
- If a custom Q&A matches the user's question, use that exact answer
- If you don't know something specific to this development, say so
- Direct complex issues to the developer or management company`;

    // Call OpenAI API
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

    return NextResponse.json({ response: assistantResponse });
  } catch (err) {
    console.error('Error testing assistant:', err);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
