import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/intelligence/transcribe
 * Accepts an audio blob (multipart/form-data field "audio"), returns a final transcript.
 * Primary: Deepgram Nova-3 (better latency + Irish accent handling).
 * Fallback: OpenAI Whisper Large v3.
 *
 * Streaming partial transcripts are handled client-side via the Web Speech API where
 * available. This endpoint produces the canonical final transcript that the action
 * extraction step runs against.
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

    let transcript: string | null = null;
    let provider: 'deepgram' | 'whisper' | 'mock' = 'mock';
    let providerError: string | null = null;

    if (process.env.DEEPGRAM_API_KEY) {
      try {
        transcript = await transcribeWithDeepgram(audioBuffer, mimeType);
        provider = 'deepgram';
      } catch (err: any) {
        providerError = `deepgram: ${err.message}`;
      }
    }

    if (!transcript && process.env.OPENAI_API_KEY) {
      try {
        transcript = await transcribeWithWhisper(audioBuffer, mimeType);
        provider = 'whisper';
      } catch (err: any) {
        providerError = providerError
          ? `${providerError}; whisper: ${err.message}`
          : `whisper: ${err.message}`;
      }
    }

    if (!transcript) {
      return NextResponse.json(
        {
          error: 'Transcription failed',
          details: providerError || 'No transcription provider configured',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ transcript, provider });
  } catch (error: any) {
    console.error('[agent/intelligence/transcribe] Error:', error.message);
    return NextResponse.json(
      { error: 'Transcription request failed', details: error.message },
      { status: 500 }
    );
  }
}

async function transcribeWithDeepgram(audio: Buffer, mimeType: string): Promise<string> {
  const params = new URLSearchParams({
    model: 'nova-3',
    smart_format: 'true',
    punctuate: 'true',
    language: 'en',
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': mimeType,
    },
    body: audio,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deepgram ${res.status}: ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const transcript: string =
    json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

  if (!transcript.trim()) {
    throw new Error('Deepgram returned empty transcript');
  }

  return transcript.trim();
}

async function transcribeWithWhisper(audio: Buffer, mimeType: string): Promise<string> {
  const form = new FormData();
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  form.append('file', new Blob([audio], { type: mimeType }), `capture.${ext}`);
  form.append('model', 'whisper-1');
  form.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: form as any,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper ${res.status}: ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const transcript: string = json?.text ?? '';

  if (!transcript.trim()) {
    throw new Error('Whisper returned empty transcript');
  }

  return transcript.trim();
}
