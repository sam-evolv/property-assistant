/**
 * Integration guards for the broadcast routes.
 *
 * Hermetic. Stubs `@supabase/auth-helpers-nextjs`, `next/headers`,
 * `@/lib/supabase-server`, and `@/lib/agent-intelligence/resolve-agent-v2`
 * via jest.doMock. The broadcast-tools module is stubbed too so the route
 * tests verify wire contract + selection logic only.
 *
 * Covered:
 *   - 401 unauthenticated (confirm)
 *   - 403 missing tenant (confirm)
 *   - happy path: 3 recipients, all selected, 3 drafts written, audit id returned
 *   - selective: 3 recipients, 2 selected by applicant_id, 2 drafts written
 *   - cancel before send: drafts deleted, audit cancelled
 */

const DEFAULT_AGENT_CTX = {
  agentProfileId: 'profile-1',
  authUserId: 'auth-1',
  tenantId: 'tenant-1',
  displayName: 'Sarah Mitchell',
  agencyName: 'Bridge Property Group',
  agentType: 'sales',
  assignedSchemes: [],
  assignedDevelopmentIds: ['dev-lakeside'],
  assignedDevelopmentNames: ['Lakeside Manor'],
  isDemoMode: true,
};

interface ConfirmStub {
  status: 'success' | 'error';
  broadcast_id: string | null;
  drafts_written: number;
  error: string | null;
}

interface CancelStub {
  status: 'success' | 'error' | 'expired' | 'already_cancelled' | 'not_found';
  drafts_deleted: number;
  error: string | null;
}

interface RouteStubState {
  authUser: { id: string } | null;
  agentContext: Record<string, any> | null;
  confirmResult?: ConfirmStub;
  cancelResult?: CancelStub;
  recordedConfirm?: any;
  recordedCancel?: any;
}

function fakeRequest(body: any, searchParams?: Record<string, string>): any {
  return {
    async json() {
      return body;
    },
    nextUrl: {
      searchParams: {
        get(key: string) {
          return searchParams?.[key] ?? null;
        },
      },
    },
  };
}

async function loadConfirmRoute(state: RouteStubState) {
  jest.resetModules();
  jest.doMock('@supabase/auth-helpers-nextjs', () => ({
    createRouteHandlerClient: () => ({
      auth: { getUser: async () => ({ data: { user: state.authUser } }) },
    }),
  }));
  jest.doMock('next/headers', () => ({ cookies: () => ({}) }));
  jest.doMock('@/lib/supabase-server', () => ({
    getSupabaseAdmin: () => ({}),
  }));
  jest.doMock('@/lib/agent-intelligence/resolve-agent-v2', () => ({
    resolveAgentContextV2: async () => ({ context: state.agentContext }),
  }));
  jest.doMock('@/lib/agent-intelligence/tools/broadcast-tools', () => ({
    async confirmBroadcast(_supabase: any, _ctx: any, input: any) {
      state.recordedConfirm = input;
      return (
        state.confirmResult ?? {
          status: 'success',
          broadcast_id: 'broadcast-1',
          drafts_written: input.emails.length,
          error: null,
        }
      );
    },
  }));
  const mod = await import('../../app/api/agent-intelligence/confirm-broadcast/route');
  return mod.POST;
}

async function loadCancelRoute(state: RouteStubState) {
  jest.resetModules();
  jest.doMock('@supabase/auth-helpers-nextjs', () => ({
    createRouteHandlerClient: () => ({
      auth: { getUser: async () => ({ data: { user: state.authUser } }) },
    }),
  }));
  jest.doMock('next/headers', () => ({ cookies: () => ({}) }));
  jest.doMock('@/lib/supabase-server', () => ({
    getSupabaseAdmin: () => ({}),
  }));
  jest.doMock('@/lib/agent-intelligence/resolve-agent-v2', () => ({
    resolveAgentContextV2: async () => ({ context: state.agentContext }),
  }));
  jest.doMock('@/lib/agent-intelligence/tools/broadcast-tools', () => ({
    async cancelBroadcast(_supabase: any, _ctx: any, input: any) {
      state.recordedCancel = input;
      return (
        state.cancelResult ?? {
          status: 'success',
          drafts_deleted: 3,
          error: null,
        }
      );
    },
  }));
  const mod = await import('../../app/api/agent-intelligence/cancel-broadcast/route');
  return mod.POST;
}

function makeDraft(emailCount: number) {
  const emails = Array.from({ length: emailCount }, (_, i) => ({
    applicant_id: `appl-${i}`,
    recipient_email: `person${i}@example.ie`,
    recipient_name: `Person ${i}`,
    subject: `Saturday viewings ${i}`,
    body: `Hi Person ${i},\n\nSaturday 10-2.\n\nCheers,\nSarah`,
    selected: true,
  }));
  return {
    status: 'draft',
    type: 'broadcast',
    intent: 'Saturday viewings 10-2',
    filter_used: { interested_in_scheme_ids: ['dev-lakeside'] },
    filter_natural: 'everyone interested in Lakeside Manor',
    tone: 'warm',
    recipients: emails.map((e) => ({
      applicant_id: e.applicant_id,
      name: e.recipient_name,
      email: e.recipient_email,
      scheme_of_interest_id: 'dev-lakeside',
      scheme_of_interest_name: 'Lakeside Manor',
      last_contact_date: null,
    })),
    emails,
    shared_signoff: 'Sarah Mitchell, Bridge Property Group',
    message: `Draft ${emailCount} emails for review`,
  };
}

describe('POST /api/agent-intelligence/confirm-broadcast', () => {
  it('returns 401 when unauthenticated', async () => {
    const state: RouteStubState = { authUser: null, agentContext: DEFAULT_AGENT_CTX };
    const POST = await loadConfirmRoute(state);
    const res = await POST(fakeRequest({ draft: makeDraft(3) }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the agent has no tenant assignment', async () => {
    const state: RouteStubState = {
      authUser: { id: 'auth-1' },
      agentContext: { ...DEFAULT_AGENT_CTX, tenantId: null },
    };
    const POST = await loadConfirmRoute(state);
    const res = await POST(fakeRequest({ draft: makeDraft(3) }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when draft.emails is empty', async () => {
    const state: RouteStubState = { authUser: { id: 'auth-1' }, agentContext: DEFAULT_AGENT_CTX };
    const POST = await loadConfirmRoute(state);
    const empty = { ...makeDraft(0), emails: [] };
    const res = await POST(fakeRequest({ draft: empty }));
    expect(res.status).toBe(400);
  });

  it('writes one draft per recipient when none are deselected (happy path)', async () => {
    const state: RouteStubState = { authUser: { id: 'auth-1' }, agentContext: DEFAULT_AGENT_CTX };
    const POST = await loadConfirmRoute(state);
    const draft = makeDraft(3);
    const res = await POST(fakeRequest({ draft }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.drafts_written).toBe(3);
    expect(state.recordedConfirm?.emails.length).toBe(3);
  });

  it('honours selected_applicant_ids to write only the selected subset', async () => {
    const state: RouteStubState = { authUser: { id: 'auth-1' }, agentContext: DEFAULT_AGENT_CTX };
    const POST = await loadConfirmRoute(state);
    const draft = makeDraft(3);
    const res = await POST(
      fakeRequest({ draft, selected_applicant_ids: ['appl-0', 'appl-2'] }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drafts_written).toBe(2);
    expect(state.recordedConfirm?.emails.length).toBe(2);
    expect(state.recordedConfirm?.emails.map((e: any) => e.applicant_id).sort()).toEqual([
      'appl-0',
      'appl-2',
    ]);
  });

  it('surfaces a 500 when the broadcast helper reports an error', async () => {
    const state: RouteStubState = {
      authUser: { id: 'auth-1' },
      agentContext: DEFAULT_AGENT_CTX,
      confirmResult: {
        status: 'error',
        broadcast_id: 'broadcast-1',
        drafts_written: 0,
        error: 'audit insert failed',
      },
    };
    const POST = await loadConfirmRoute(state);
    const res = await POST(fakeRequest({ draft: makeDraft(2) }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.error).toMatch(/audit/i);
  });
});

describe('POST /api/agent-intelligence/cancel-broadcast', () => {
  it('returns 401 when unauthenticated', async () => {
    const state: RouteStubState = { authUser: null, agentContext: DEFAULT_AGENT_CTX };
    const POST = await loadCancelRoute(state);
    const res = await POST(fakeRequest({ audit_log_id: 'broadcast-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when the broadcast was not found for this agent', async () => {
    const state: RouteStubState = {
      authUser: { id: 'auth-1' },
      agentContext: DEFAULT_AGENT_CTX,
      cancelResult: { status: 'not_found', drafts_deleted: 0, error: 'Broadcast not found.' },
    };
    const POST = await loadCancelRoute(state);
    const res = await POST(fakeRequest({ audit_log_id: 'broadcast-1' }));
    expect(res.status).toBe(404);
  });

  it('returns 410 when the 30-minute undo window has expired', async () => {
    const state: RouteStubState = {
      authUser: { id: 'auth-1' },
      agentContext: DEFAULT_AGENT_CTX,
      cancelResult: {
        status: 'expired',
        drafts_deleted: 0,
        error: 'The 30-minute undo window has passed.',
      },
    };
    const POST = await loadCancelRoute(state);
    const res = await POST(fakeRequest({ audit_log_id: 'broadcast-1' }));
    expect(res.status).toBe(410);
  });

  it('cancels and reports the number of drafts deleted on success', async () => {
    const state: RouteStubState = {
      authUser: { id: 'auth-1' },
      agentContext: DEFAULT_AGENT_CTX,
      cancelResult: { status: 'success', drafts_deleted: 2, error: null },
    };
    const POST = await loadCancelRoute(state);
    const res = await POST(fakeRequest({ audit_log_id: 'broadcast-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.drafts_deleted).toBe(2);
  });
});
