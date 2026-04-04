/**
 * POST /api/select/intelligence/chat
 *
 * Select-tier homeowner AI assistant with RAG retrieval.
 * Self-contained — does not modify /api/chat or /api/care/chat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── Rate limit ───────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// ─── Clients ──────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(params: {
  homeownerName: string;
  developmentName: string;
  builderName: string;
  handoverDate?: string | null;
}): string {
  const { homeownerName, developmentName, builderName, handoverDate } = params;

  const daysSinceHandover = handoverDate
    ? Math.floor((Date.now() - new Date(handoverDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handoverContext =
    daysSinceHandover !== null
      ? daysSinceHandover < 30
        ? `${homeownerName} moved in ${daysSinceHandover} days ago — they're still getting settled.`
        : daysSinceHandover < 365
        ? `${homeownerName} has been in the home for ${Math.floor(daysSinceHandover / 30)} months.`
        : `${homeownerName} has been in their home for over a year now.`
      : '';

  return `You are the home assistant for ${homeownerName}'s home at ${developmentName}, built by ${builderName}.

You are part of OpenHouse Select — the premium homeowner platform for bespoke Irish new homes. ${homeownerName} has access to you because they chose a Select home. This assistant is part of that premium experience.

${handoverContext}

IDENTITY

You know this home. You were with ${homeownerName} through the build journey — the selections made, the milestones, the day they got their keys. You are not a help desk or a chatbot. You are a knowledgeable guide who knows this specific home and genuinely cares about the experience in it.

TONE

- Warm, direct, and personal. Use ${homeownerName}'s name naturally — not every message, but when it fits.
- Lead with the answer. Context comes after.
- Irish English: colour, centre, realise. Phrases like "no bother" or "grand" fit when natural — never forced.
- Plain text only. No markdown, no asterisks, no hashes. Lists use plain dashes or numbers. Section labels use a colon: "Heating:" not "**Heating:**".
- Never use filler: "great question", "feel free to ask", "don't hesitate", "happy to help". Just answer.
- Never start a response with "I".
- If they're relaxed and chatty, match that. If something is urgent, be clear and short.

WHAT YOU KNOW

You have access to documents and specifications for ${homeownerName}'s home at ${developmentName}. When relevant information is in the reference data, use it. When you don't have something, say so clearly and always tell ${homeownerName} what to do next — who to contact, where to look. Never leave them with nothing to do.

PROBLEMS AND DEFECTS

If ${homeownerName} raises something that isn't right with the home:
- Acknowledge it first before jumping to solutions.
- Give any practical immediate guidance you can.
- Direct them clearly to the right contact: ${builderName} aftercare, snagging team, or emergency line depending on the situation.
- Never minimise or dismiss a concern.

SAFETY — EMERGENCIES

For anything involving gas, fire, flooding, electrical faults, structural movement, or carbon monoxide:
- Lead immediately with the emergency action: evacuate / Gas Networks Ireland 1800 20 50 50 / call 999.
- Keep it short. No preamble.

For safety-critical DIY questions (removing walls, altering systems):
- Never confirm anything is safe to alter or modify.
- Direct to the right professional.

PRIVACY

Only discuss ${homeownerName}'s own home. Never share or speculate about other units or residents.

ROOM DIMENSIONS

Never quote specific measurements. If asked: "The floor plan will have the accurate dimensions — I can point you to it."

HIGH-RISK TOPICS

- Medical: redirect to GP or 999.
- Legal property matters: redirect to their solicitor.
- Structural concerns: structural engineer or ${builderName} warranty team.
- Electrical faults: registered electrician.
- Gas: Gas Networks Ireland 1800 20 50 50 — evacuate immediately for any suspected leak.`;
}

// ─── RAG retrieval ────────────────────────────────────────────────────────────
async function retrieveContext(
  query: string,
  developmentId: string,
): Promise<string> {
  try {
    const openai = getOpenAI();
    const supabase = getSupabase();

    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const embedding = embRes.data[0].embedding;

    const { data, error } = await supabase.rpc('match_document_sections', {
      query_embedding: embedding,
      match_project_id: developmentId,
      match_count: 10,
    });

    if (error || !data?.length) return '';

    const TOP_N = 6;
    const MIN_SIMILARITY = 0.72;

    const chunks = (data as any[])
      .filter((c: any) => (c.similarity ?? 0) >= MIN_SIMILARITY)
      .slice(0, TOP_N)
      .map((c: any) => c.content)
      .join('\n\n');

    if (!chunks) return '';

    return `\n--- BEGIN REFERENCE DATA ---\n${chunks}\n--- END REFERENCE DATA ---`;
  } catch (err) {
    console.error('[Select Chat] RAG retrieval failed:', err);
    return '';
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = await request.json();
    const {
      messages: history = [],
      unit_id,
      development_id,
      homeowner_name,
      development_name,
      builder_name,
      handover_date,
    } = body;

    if (!development_id || !homeowner_name) {
      return NextResponse.json(
        { error: 'development_id and homeowner_name required' },
        { status: 400 }
      );
    }

    const rateLimitKey = unit_id || development_id;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before sending another message.' },
        { status: 429 }
      );
    }

    // Latest user message
    const latestUserMessage = [...history].reverse().find((m: any) => m.role === 'user');
    const userText: string = latestUserMessage?.content ?? '';

    if (!userText.trim()) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    // RAG
    const ragContext = await retrieveContext(userText, development_id);

    // System prompt
    const basePrompt = buildSystemPrompt({
      homeownerName: homeowner_name,
      developmentName: development_name,
      builderName: builder_name,
      handoverDate: handover_date,
    });
    const systemPrompt = ragContext ? `${basePrompt}${ragContext}` : basePrompt;

    // Build OpenAI messages
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
        })),
    ];

    // Completion
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.4,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const latencyMs = Date.now() - start;

    // Log to messages table
    try {
      await db.insert(messages).values({
        tenant_id: null,
        development_id: development_id || null,
        unit_id: unit_id || null,
        user_id: null,
        content: userText,
        user_message: userText,
        ai_message: content,
        question_topic: null,
        sender: 'conversation',
        source: 'select',
        token_count: 0,
        cost_usd: '0',
        latency_ms: latencyMs,
        metadata: { assistant: 'select', homeowner_name },
      });
    } catch (logErr) {
      // Non-fatal — log but don't fail the response
      console.error('[Select Chat] Failed to log message:', logErr);
    }

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[Select Chat] Error:', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
