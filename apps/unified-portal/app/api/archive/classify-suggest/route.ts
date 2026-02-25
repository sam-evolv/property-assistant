import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { DISCIPLINES } from '@/lib/archive-constants';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fileName = formData.get('fileName') as string;

    if (!fileName) return NextResponse.json({ discipline: null });

    const disciplineList = Object.keys(DISCIPLINES).join(', ');

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Given this document filename: "${fileName}", classify it into ONE of these disciplines: ${disciplineList}. Reply with ONLY the discipline key, nothing else. If unsure, reply "other".`,
        },
      ],
      max_tokens: 20,
      temperature: 0,
    });

    const suggested = completion.choices[0].message.content?.trim().toLowerCase();
    const validDisciplines = Object.keys(DISCIPLINES);
    const discipline = validDisciplines.includes(suggested || '') ? suggested : 'other';

    return NextResponse.json({ discipline });
  } catch {
    return NextResponse.json({ discipline: null });
  }
}
