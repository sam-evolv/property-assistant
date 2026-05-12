/**
 * Session 5B integration guards for the post-viewing voice capture route.
 *
 * `POST /api/agent-intelligence/voice-capture/post-viewing` runs the full
 * pipeline: auth → tenant ownership check → transcribe → orchestrate. These
 * tests pin the response contract for each of those boundaries so a refactor
 * can't quietly drop a status code.
 *
 * The tests use the same hermetic shape as orchestration.test.ts: stubbed
 * Supabase, stubbed transcription module, stubbed agent-context resolver.
 * No real audio, no real OpenAI call.
 *
 * The route module imports several singletons at top-level
 * (createRouteHandlerClient, getSupabaseAdmin, resolveAgentContextV2,
 * transcribeAudio). The setup function below installs jest.doMock entries
 * for each, then dynamically imports the POST handler so the stubs are in
 * place before the module evaluates.
 */

import type { PostViewingCaptureResult } from '../../lib/agent-intelligence/tools/voice-capture-tools';

type Row = Record<string, any>;

interface StubState {
  authUser: { id: string } | null;
  viewing: Row | null;
  agentContext: Row | null;
  transcribeResult?: { transcript: string };
  transcribeError?: { message: string; stage: 'too_large' | 'empty' | 'provider' | 'no_provider' };
  orchestratorResult?: PostViewingCaptureResult;
  orchestratorThrows?: Error;
}

function makeFakeSupabase(state: StubState) {
  return {
    from(table: string) {
      const filters: Row = {};
      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: any) {
          filters[col] = val;
          return builder;
        },
        async maybeSingle() {
          if (table === 'viewings' || table === 'agent_viewings') {
            const row = state.viewing;
            if (!row) return { data: null, error: null };
            if (filters.id && row.id !== filters.id) return { data: null, error: null };
            if (filters.tenant_id && row.tenant_id !== filters.tenant_id) return { data: null, error: null };
            if (table === 'viewings' && row.__source !== 'viewings') return { data: null, error: null };
            if (table === 'agent_viewings' && row.__source !== 'agent_viewings') return { data: null, error: null };
            return { data: row, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}

function buildAudioFormData(audio: Blob | null, viewingId: string | null): FormData {
  const form = new FormData();
  if (audio) form.append('audio', audio, 'capture.webm');
  if (viewingId !== null) form.append('viewing_id', viewingId);
  return form;
}

function fakeRequest(form: FormData): any {
  return {
    async formData() {
      return form;
    },
  };
}

const DEFAULT_AGENT_CTX = {
  agentProfileId: 'profile-1',
  authUserId: 'auth-1',
  tenantId: 'tenant-1',
  displayName: 'Sarah Mitchell',
  agencyName: 'Bridge Property',
  agentType: 'sales',
  assignedSchemes: [],
  assignedDevelopmentIds: ['dev-1'],
  assignedDevelopmentNames: ['Lakeside Manor'],
  isDemoMode: true,
};

const DEFAULT_VIEWING = {
  id: 'view-1',
  tenant_id: 'tenant-1',
  agent_id: 'auth-1',
  applicant_id: 'appl-1',
  development_id: 'dev-1',
  scheduled_at: '2026-05-13T16:00:00Z',
  duration_minutes: 30,
  location: 'Lakeside Manor',
  notes: null,
  status: 'scheduled',
  device_calendar_event_id: null,
  __source: 'viewings',
};

const HAPPY_RESULT: PostViewingCaptureResult = {
  ok: true,
  transcript: 'Viewing with Niamh went really well, follow up Friday morning.',
  confidence: 'high',
  outcome: 'high_interest',
  saved: {
    viewing_status: 'completed',
    notes_added: 3,
    reminders_created: 1,
    audit_log_id: 'audit-1',
  },
  pending_approval: {
    follow_up_email: {
      pending_draft_id: 'draft-1',
      subject: 'Following up on your viewing at Lakeside Manor',
      body: "Hi Niamh,\n\nGreat to see you yesterday.\n\nCheers,\nSarah",
      tone: 'warm',
      addresses_concerns: ['Worried about heating bills'],
    } as any,
    clarifications: [],
  },
  errors: [],
  viewing: {
    viewing_id: 'view-1',
    source: 'viewings',
    applicant_id: 'appl-1',
    applicant_name: "Niamh O'Brien",
    development_name: 'Lakeside Manor',
    scheduled_at: '2026-05-13T16:00:00Z',
  },
};

async function loadRouteWithStubs(state: StubState) {
  jest.resetModules();

  jest.doMock('@supabase/auth-helpers-nextjs', () => ({
    createRouteHandlerClient: () => ({
      auth: { getUser: async () => ({ data: { user: state.authUser } }) },
    }),
  }));

  jest.doMock('next/headers', () => ({
    cookies: () => ({}),
  }));

  jest.doMock('@/lib/supabase-server', () => ({
    getSupabaseAdmin: () => makeFakeSupabase(state),
  }));

  jest.doMock('@/lib/agent-intelligence/resolve-agent-v2', () => ({
    resolveAgentContextV2: async () => ({ context: state.agentContext }),
  }));

  jest.doMock('@/lib/agent-intelligence/transcription', () => {
    class TranscriptionError extends Error {
      constructor(message: string, public stage: string, public providerDetail?: string) {
        super(message);
      }
    }
    return {
      TranscriptionError,
      async transcribeAudio() {
        if (state.transcribeError) {
          throw new TranscriptionError(
            state.transcribeError.message,
            state.transcribeError.stage,
            'stub',
          );
        }
        return {
          transcript: state.transcribeResult?.transcript || 'stub transcript',
          provider: 'whisper',
          duration_seconds: 12,
          language: 'en',
        };
      },
    };
  });

  jest.doMock('@/lib/agent-intelligence/tools/voice-capture-tools', () => ({
    async executePostViewingCapture() {
      if (state.orchestratorThrows) throw state.orchestratorThrows;
      return state.orchestratorResult || HAPPY_RESULT;
    },
  }));

  const mod = await import('../../app/api/agent-intelligence/voice-capture/post-viewing/route');
  return mod.POST;
}

describe('POST /api/agent-intelligence/voice-capture/post-viewing', () => {
  it('returns 401 when the request is not authenticated', async () => {
    const POST = await loadRouteWithStubs({
      authUser: null,
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/authenticated/i);
  });

  it('returns 400 when the audio field is missing', async () => {
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
    });
    const form = buildAudioFormData(null, 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/audio/i);
  });

  it('returns 400 when the viewing_id field is missing', async () => {
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), null);
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/viewing_id/i);
  });

  it('returns 403 when the viewing is not in the authenticated tenant', async () => {
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: null, // not found in either viewings or agent_viewings
      agentContext: DEFAULT_AGENT_CTX,
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(403);
  });

  it('returns 200 with a partial-success envelope on the happy path', async () => {
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.transcript).toBe('string');
    expect(body.transcript.length).toBeGreaterThan(0);
    expect(body.saved.viewing_status).toBe('completed');
    expect(body.saved.notes_added).toBe(3);
    expect(body.pending_approval.follow_up_email).not.toBeNull();
  });

  it('returns 502 when transcription fails with a provider error', async () => {
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
      transcribeError: { message: "Couldn't transcribe, try again.", stage: 'provider' },
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.step).toBe('transcribe');
  });

  it('returns 413 when the recording is too large', async () => {
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
      transcribeError: { message: 'too big', stage: 'too_large' },
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(413);
  });

  it('returns 200 + ok=false when the orchestrator partial-fails', async () => {
    const partial: PostViewingCaptureResult = {
      ...HAPPY_RESULT,
      ok: false,
      errors: [{ step: 'persist_draft', message: 'insert failed' }],
      pending_approval: {
        ...HAPPY_RESULT.pending_approval,
        follow_up_email: {
          ...(HAPPY_RESULT.pending_approval.follow_up_email as any),
          pending_draft_id: null,
        },
      },
    };
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
      orchestratorResult: partial,
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].step).toBe('persist_draft');
    expect(body.pending_approval.follow_up_email.pending_draft_id).toBeNull();
  });

  it('returns 500 with a clean message when the orchestrator throws unexpectedly', async () => {
    const POST = await loadRouteWithStubs({
      authUser: { id: 'auth-1' },
      viewing: DEFAULT_VIEWING,
      agentContext: DEFAULT_AGENT_CTX,
      orchestratorThrows: new Error('LLM returned malformed JSON'),
    });
    const form = buildAudioFormData(new Blob(['x'], { type: 'audio/webm' }), 'view-1');
    const res = await POST(fakeRequest(form));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});
