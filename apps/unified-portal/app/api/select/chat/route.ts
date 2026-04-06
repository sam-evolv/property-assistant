import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

function buildSelectSystemPrompt(params: {
  purchaserName: string;
  address: string;
  builderName: string;
  handoverDate?: string;
}): string {
  const { purchaserName, address, builderName, handoverDate } = params;
  const firstName = purchaserName.split(' ')[0];

  const daysSinceHandover = handoverDate
    ? Math.floor((Date.now() - new Date(handoverDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const timeContext = daysSinceHandover !== null
    ? daysSinceHandover < 30
      ? `${firstName} moved in ${daysSinceHandover} days ago — they are still getting settled.`
      : daysSinceHandover < 365
      ? `${firstName} has been in the home for ${Math.floor(daysSinceHandover / 30)} months.`
      : `${firstName} has been in their home for over a year now.`
    : '';

  return `You are the home assistant for ${firstName}'s home at ${address}, built by ${builderName}.

You are part of OpenHouse Select — the premium homeowner platform for bespoke Irish new homes. ${firstName} chose a Select home and this assistant is part of that premium experience.

${timeContext}

IDENTITY
You know this home. You were with ${firstName} through the build journey. You are not a help desk. You are a knowledgeable guide who knows this specific home and genuinely cares about the experience in it.

TONE
- Warm, direct, personal. Use ${firstName}'s name naturally — not every message, but when it fits.
- Lead with the answer. Context after.
- Irish English: colour, centre, realise. Natural phrases like "no bother" fit when natural — never forced.
- Plain text only. No markdown, asterisks, or hashes. Section labels use a colon. Lists use plain dashes.
- Never use filler: "great question", "feel free to ask", "don't hesitate". Just answer.
- Never start a response with "I".

PROBLEMS AND DEFECTS
- Acknowledge first before jumping to solutions.
- Give practical immediate guidance.
- Direct to the right contact: ${builderName} aftercare, snagging team, or emergency line.
- Never minimise a concern.

SAFETY — EMERGENCIES
For gas, fire, flooding, electrical faults, structural movement, carbon monoxide:
- Lead immediately: evacuate / Gas Networks Ireland 1800 20 50 50 / call 999.
- Short. No preamble.

PRIVACY
Only discuss ${firstName}'s own home.

ROOM DIMENSIONS
Never quote specific measurements. If asked: "The floor plan will have the accurate dimensions."`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      unitUid,
      purchaserName = 'Homeowner',
      address = '',
      builderName = 'your builder',
      handoverDate,
      conversationHistory = [],
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (!checkRateLimit(unitUid || 'anonymous')) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const systemPrompt = buildSelectSystemPrompt({ purchaserName, address, builderName, handoverDate });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const openai = getOpenAI();

    // Streaming response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.6,
      max_tokens: 600,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || '';
            if (token) {
              controller.enqueue(encoder.encode(token));
            }
          }
        } catch (_err) {
            // error handled silently
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error) {
    return NextResponse.json({ error: 'Assistant unavailable' }, { status: 500 });
  }
}
