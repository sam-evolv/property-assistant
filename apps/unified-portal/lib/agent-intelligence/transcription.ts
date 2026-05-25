/**
 * Shared audio transcription helper.
 *
 * Two routes call into this:
 *   - /api/agent/intelligence/transcribe — generic voice input on the
 *     intelligence screen (chat dictation).
 *   - /api/agent-intelligence/transcribe-voice — context-aware endpoint
 *     used by the post-viewing voice capture loop.
 *
 * Provider order: Deepgram Nova-3 (better Irish accent latency) first,
 * Whisper-1 as fallback. Either can be missing — the helper returns
 * what's available.
 */

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // ~25 MB, ~5 minutes of webm/opus

export interface TranscriptionResult {
  transcript: string;
  provider: 'deepgram' | 'whisper';
  duration_seconds: number | null;
  language: string;
}

// Whisper accepts a `prompt` parameter that biases token selection toward the
// listed vocabulary. It doesn't constrain output. Used here to nudge Whisper
// toward Irish placenames and property-domain terms the agent is likely to
// say, which materially improves transcription accuracy on Irish accents.
export function buildVocabularyPrompt(developmentNames: string[]): string {
  const base =
    'Irish English speaker. Property domain. ' +
    'Common terms: BER, RTB, RPZ, Part 4 tenancy, snag list, ' +
    'lease renewal, viewing, applicant, buyer, tenant, unit, ' +
    'scheme, development, contracts issued.';
  const cleaned = developmentNames
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => n.length > 0);
  if (cleaned.length === 0) {
    return (
      base +
      ' Common Irish placenames including Cork, Dublin, Galway, Limerick, Waterford.'
    );
  }
  return base + ' Schemes mentioned often: ' + cleaned.join(', ') + '.';
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly stage: 'too_large' | 'empty' | 'provider' | 'no_provider',
    public readonly providerDetail?: string,
  ) {
    super(message);
  }
}

export async function transcribeAudio(
  audio: Buffer,
  mimeType: string,
  options: { vocabularyPrompt?: string; language?: string } = {},
): Promise<TranscriptionResult> {
  if (audio.byteLength === 0) {
    throw new TranscriptionError('Audio file is empty', 'empty');
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new TranscriptionError(
      'Audio file is too large. Keep recordings under 5 minutes.',
      'too_large',
    );
  }

  let lastError: string | null = null;

  if (process.env.DEEPGRAM_API_KEY) {
    try {
      return await transcribeWithDeepgram(audio, mimeType, options.language);
    } catch (err: any) {
      lastError = `deepgram: ${err?.message ?? 'unknown'}`;
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await transcribeWithWhisper(audio, mimeType, options.vocabularyPrompt, options.language);
    } catch (err: any) {
      lastError = lastError
        ? `${lastError}; whisper: ${err?.message ?? 'unknown'}`
        : `whisper: ${err?.message ?? 'unknown'}`;
    }
  }

  if (!lastError) {
    throw new TranscriptionError(
      'No transcription provider configured',
      'no_provider',
    );
  }
  throw new TranscriptionError(
    "Couldn't transcribe. Try again.",
    'provider',
    lastError,
  );
}

async function transcribeWithDeepgram(
  audio: Buffer,
  mimeType: string,
  language?: string,
): Promise<TranscriptionResult> {
  const params = new URLSearchParams({
    model: 'nova-3',
    smart_format: 'true',
    punctuate: 'true',
  });
  // A caller-supplied hint pins the language; otherwise let Nova-3 auto-detect
  // (the homeowner app speaks 9 languages, so hardcoding 'en' mis-transcribed
  // everyone else).
  if (language) {
    params.set('language', language);
  } else {
    params.set('detect_language', 'true');
  }

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': mimeType,
    },
    body: audio as any,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Deepgram ${res.status}: ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const channel: any = json?.results?.channels?.[0];
  const transcript: string = channel?.alternatives?.[0]?.transcript ?? '';
  const duration: number | null =
    typeof json?.metadata?.duration === 'number' ? json.metadata.duration : null;
  // Deepgram reports the detected language on the channel when detect_language
  // is on; fall back to the hint, then 'en'.
  const detectedLanguage: string =
    typeof channel?.detected_language === 'string' && channel.detected_language.length
      ? channel.detected_language
      : language || 'en';

  if (!transcript.trim()) {
    throw new Error('Deepgram returned empty transcript');
  }

  return {
    transcript: transcript.trim(),
    provider: 'deepgram',
    duration_seconds: duration,
    language: detectedLanguage,
  };
}

async function transcribeWithWhisper(
  audio: Buffer,
  mimeType: string,
  vocabularyPrompt?: string,
  language?: string,
): Promise<TranscriptionResult> {
  const form = new FormData();
  const ext = mimeExtension(mimeType);
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `capture.${ext}`);
  form.append('model', 'whisper-1');
  // Omit `language` to let Whisper auto-detect; pass it only as a caller hint.
  if (language) {
    form.append('language', language);
  }
  form.append('response_format', 'verbose_json');
  if (vocabularyPrompt && vocabularyPrompt.length > 0) {
    form.append('prompt', vocabularyPrompt);
  }

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form as any,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper ${res.status}: ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const transcript: string = json?.text ?? '';
  const duration: number | null =
    typeof json?.duration === 'number' ? json.duration : null;
  // Whisper reports the detected language in verbose_json; fall back to the
  // caller hint, then 'en'.
  const detectedLanguage: string =
    typeof json?.language === 'string' && json.language.length
      ? json.language
      : language || 'en';

  if (!transcript.trim()) {
    throw new Error('Whisper returned empty transcript');
  }

  return {
    transcript: transcript.trim(),
    provider: 'whisper',
    duration_seconds: duration,
    language: detectedLanguage,
  };
}

function mimeExtension(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  return 'webm';
}
