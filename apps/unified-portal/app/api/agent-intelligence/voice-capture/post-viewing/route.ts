import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import {
  transcribeAudio,
  TranscriptionError,
  buildVocabularyPrompt,
} from '@/lib/agent-intelligence/transcription';
import { executePostViewingCapture } from '@/lib/agent-intelligence/tools/voice-capture-tools';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent-intelligence/voice-capture/post-viewing
 *
 * Multipart body:
 *   - audio: the recording (mp3 | wav | m4a | webm)
 *   - viewing_id: viewings.id or agent_viewings.id (tenant-scoped)
 *
 * Pipeline: auth → transcribe → orchestrator → response envelope. The
 * orchestrator returns a partial-success envelope even when individual
 * steps fail, so the UI can show what saved and what didn't. We return
 * 4xx/5xx only for hard failures (no audio, not authenticated, viewing
 * not in tenant).
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
    const viewingId = form.get('viewing_id');

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }
    if (typeof viewingId !== 'string' || viewingId.length === 0) {
      return NextResponse.json({ error: 'viewing_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const v2 = await resolveAgentContextV2(supabase, user.id);
    const resolved = v2.context;
    if (!resolved) {
      return NextResponse.json({ error: 'No agent profile found' }, { status: 401 });
    }

    const agentContext: AgentContext = {
      agentProfileId: resolved.agentProfileId,
      authUserId: resolved.authUserId,
      tenantId: resolved.tenantId ?? '',
      displayName: resolved.displayName,
      agencyName: resolved.agencyName,
      agentType: resolved.agentType,
      assignedSchemes: resolved.assignedSchemes,
      assignedDevelopmentIds: resolved.assignedDevelopmentIds,
      assignedDevelopmentNames: resolved.assignedDevelopmentNames,
      activeDevelopmentId: null,
      isDemoMode: resolved.isDemoMode,
    };
    if (!agentContext.tenantId) {
      return NextResponse.json({ error: 'Agent has no tenant assignment' }, { status: 403 });
    }

    // Tenant ownership check before we burn the transcription cost.
    const [{ data: canon }, { data: legacy }] = await Promise.all([
      supabase
        .from('viewings')
        .select('id, agent_id')
        .eq('id', viewingId)
        .eq('tenant_id', agentContext.tenantId)
        .maybeSingle(),
      supabase
        .from('agent_viewings')
        .select('id, agent_id')
        .eq('id', viewingId)
        .eq('tenant_id', agentContext.tenantId)
        .maybeSingle(),
    ]);
    if (!canon && !legacy) {
      return NextResponse.json({ error: 'Viewing not found in your tenant' }, { status: 403 });
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const mimeType = (audio as any).type || 'audio/webm';

    let transcript: string;
    try {
      const trx = await transcribeAudio(audioBuffer, mimeType, {
        vocabularyPrompt: buildVocabularyPrompt(agentContext.assignedDevelopmentNames ?? []),
      });
      transcript = trx.transcript;
    } catch (err) {
      if (err instanceof TranscriptionError) {
        const status = err.stage === 'too_large' ? 413 : err.stage === 'empty' ? 400 : 502;
        return NextResponse.json(
          {
            error: err.message,
            details: err.providerDetail ?? null,
            step: 'transcribe',
          },
          { status },
        );
      }
      const message = err instanceof Error ? err.message : 'Transcription failed';
      console.error('[voice-capture/post-viewing] transcription error', { message });
      return NextResponse.json(
        { error: "Couldn't transcribe. Try again.", step: 'transcribe' },
        { status: 502 },
      );
    }

    const result = await executePostViewingCapture(supabase, agentContext, {
      transcript,
      viewing_id: viewingId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[voice-capture/post-viewing] failed', { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
