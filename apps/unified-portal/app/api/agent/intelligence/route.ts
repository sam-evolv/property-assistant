import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are OpenHouse Intelligence, an AI assistant for Irish estate agents.
The agent is Sarah Collins at Sherry FitzGerald Cork.
Schemes: The Coppice (Cairn Homes, 48 units, 31 sold), Harbour View (Evara Homes, 24 units, 18 sold).
Urgent: Conor Ryan (A1) and R&K Donovan (14 Fernwood) have overdue contracts. Mark Brennan (A5) has no AIP.

Respond ONLY with a valid JSON array (no markdown, no preamble, no code fences). Each element:
{ "type": "email"|"status"|"reminder"|"report", "action": "short label max 60 chars", ...fields }
Email fields: "to", "subject", "body" (\\n for newlines)
Status/reminder fields: "detail"
Report fields: "detail" (\\n• for bullets)
Max 4 steps.`;

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();

    if (!process.env.OPENAI_API_KEY && !process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return NextResponse.json(
        [{ type: 'status', action: 'Processing your request', detail: `I understand you want to: "${input}". OpenAI API key not configured. Try a quick action prompt for the demo.` }],
        { status: 200 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    });

    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
    });

    const text = res.choices[0].message.content ?? '[]';
    const steps = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json(steps);
  } catch (error) {
    console.error('[Agent Intelligence] Error:', error);
    return NextResponse.json(
      [{ type: 'status', action: 'Error processing request', detail: 'Something went wrong. Please try again.' }],
      { status: 200 }
    );
  }
}
