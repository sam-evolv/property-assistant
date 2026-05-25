import { NextRequest, NextResponse } from 'next/server';
import {
  transcribeAudio,
  TranscriptionError,
  buildVocabularyPrompt,
} from '@/lib/agent-intelligence/transcription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sanitize an optional spoken-language hint (e.g. the homeowner's selected UI
 * language). Accept only an ISO-639 style code (en, ga, pt-br, ...) so we never
 * forward arbitrary client input into the provider query/form. Returns undefined
 * for anything unexpected, which makes the providers auto-detect.
 */
function sanitizeLanguageHint(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return /^[a-z]{2,3}(-[a-z]{2,4})?$/.test(trimmed) ? trimmed : undefined;
}

/**
 * POST /api/agent/intelligence/transcribe
 * Accepts an audio blob (multipart/form-data field "audio") and an optional
 * "language" hint, returns the final transcript. Provider order: Deepgram Nova-3
 * then OpenAI Whisper-1, handled inside `transcribeAudio`. Without a hint both
 * providers auto-detect the language. Live partials are produced client-side via
 * the Web Speech API.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const audio = form.get('audio');

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const mimeType = (audio as any).type || 'audio/webm';
    const language = sanitizeLanguageHint(form.get('language'));

    const result = await transcribeAudio(audioBuffer, mimeType, {
      vocabularyPrompt: buildVocabularyPrompt([]),
      language,
    });

    return NextResponse.json({ transcript: result.transcript, provider: result.provider });
  } catch (error) {
    if (error instanceof TranscriptionError) {
      const status = error.stage === 'too_large' ? 413 : error.stage === 'empty' ? 400 : 502;
      return NextResponse.json(
        { error: error.message, details: error.providerDetail ?? null },
        { status },
      );
    }
    const message = error instanceof Error ? error.message : 'Transcription request failed';
    console.error('[agent/intelligence/transcribe] Error:', message);
    return NextResponse.json(
      { error: 'Transcription request failed', details: message },
      { status: 500 },
    );
  }
}
