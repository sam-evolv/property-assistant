import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { transcribeAudio, TranscriptionError } from '@/lib/agent-intelligence/transcription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent-intelligence/transcribe-voice
 *
 * Authenticated transcription endpoint that accepts an optional `context`
 * JSON field with shape { viewing_id?, applicant_id?, mode? }. The context
 * is echoed back so the caller can correlate the transcript with the
 * downstream action loop (e.g. post-viewing voice capture). The transcription
 * itself goes through the shared `transcribeAudio` helper — same provider
 * order as the generic transcribe endpoint.
 *
 * Returns { transcript, duration_seconds, language, provider, context }.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const form = await request.formData();
    const audio = form.get('audio');
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    let context: Record<string, unknown> | null = null;
    const rawContext = form.get('context');
    if (typeof rawContext === 'string' && rawContext.length > 0) {
      try {
        const parsed = JSON.parse(rawContext);
        if (parsed && typeof parsed === 'object') {
          context = parsed as Record<string, unknown>;
        }
      } catch {
        return NextResponse.json({ error: 'context must be valid JSON' }, { status: 400 });
      }
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const mimeType = (audio as any).type || 'audio/webm';

    const result = await transcribeAudio(audioBuffer, mimeType);

    return NextResponse.json({
      transcript: result.transcript,
      duration_seconds: result.duration_seconds,
      language: result.language,
      provider: result.provider,
      context,
    });
  } catch (error) {
    if (error instanceof TranscriptionError) {
      const status = error.stage === 'too_large' ? 413 : error.stage === 'empty' ? 400 : 502;
      return NextResponse.json(
        { error: error.message, details: error.providerDetail ?? null },
        { status },
      );
    }
    const message = error instanceof Error ? error.message : 'Transcription request failed';
    console.error('[agent-intelligence/transcribe-voice] Error:', message);
    return NextResponse.json(
      { error: "Couldn't transcribe. Try again.", details: message },
      { status: 500 },
    );
  }
}
