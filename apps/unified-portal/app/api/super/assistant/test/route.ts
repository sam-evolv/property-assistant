// /api/super/assistant/test/route.ts
// Ultra-fast test endpoint - optimized for speed
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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const body = await request.json();
    const { development_id, message, include_custom_qa } = body;

    if (!development_id || !message) {
      return NextResponse.json({ error: 'development_id and message required' }, { status: 400 });
    }

    // 1. Get development (fast query)
    const [development] = await db
      .select({
        id: developments.id,
        name: developments.name,
        system_instructions: developments.system_instructions,
      })
      .from(developments)
      .where(eq(developments.id, development_id))
      .limit(1);

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    // 2. Parallel fetch Q&As and Knowledge (run simultaneously)
    const [qasResult, knowledgeResult] = await Promise.all([
      include_custom_qa !== false 
        ? supabaseAdmin
            .from('custom_qa')
            .select('question, answer')
            .eq('development_id', development.id)
            .eq('active', true)
            .limit(3)
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from('knowledge_base')
        .select('title, content')
        .or(`development_id.eq.${development.id},development_id.is.null`)
        .eq('active', true)
        .limit(3)
    ]);

    // Build compact context
    let context = '';
    if (qasResult.data?.length) {
      context += qasResult.data.map((qa: any) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n');
    }
    if (knowledgeResult.data?.length) {
      context += '\n' + knowledgeResult.data.map((k: any) => `${k.title}: ${k.content}`).join('\n');
    }

    // 3. Minimal system prompt for speed
    const systemPrompt = `You are an assistant for ${development.name}. Be concise.
${development.system_instructions || ''}
${context}`;

    // 4. Fast OpenAI call
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 150,
      temperature: 0.2
    });

    return NextResponse.json({ 
      response: response.choices[0]?.message?.content || 'No response.',
      debug: {
        developmentName: development.name,
        hasCustomQA: !!qasResult.data?.length,
        hasKnowledge: !!knowledgeResult.data?.length,
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
