import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAdminContextFromSession } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!['developer', 'admin', 'super_admin'].includes(adminContext.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { message, response } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a 4-6 word title for this conversation. Return ONLY the title, no quotes, no punctuation at end.',
        },
        {
          role: 'user',
          content: `First message: ${message}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 30,
    });

    const title = completion.choices[0]?.message?.content?.trim() || message.slice(0, 50);

    return new Response(JSON.stringify({ title }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SchemeIntel Title] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate title' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
