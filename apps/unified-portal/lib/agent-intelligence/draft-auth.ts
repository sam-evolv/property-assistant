/**
 * Shared auth + tenant guard for the draft mutation endpoints.
 *
 * Three routes write to `pending_drafts`:
 *   - POST   /api/agent/intelligence/send-draft
 *   - PATCH  /api/agent/intelligence/drafts/[id]
 *   - DELETE /api/agent/intelligence/drafts/[id]
 *
 * Before this helper, each route used the pattern:
 *
 *     const { data: { user } } = await supabaseAuth.auth.getUser();
 *     if (user && draft.user_id !== user.id) return 403;
 *
 * which short-circuited to ALLOW when `user` was falsy (no auth cookie).
 * The routes then proceeded with `getSupabaseAdmin()` (service role,
 * bypasses RLS), so an unauthenticated POST with a known `draft.id`
 * could send / patch / delete any tenant's draft.
 *
 * This helper enforces three checks in order:
 *   1. an authenticated user must be present (return 401 otherwise);
 *   2. `draft.user_id` must match `user.id` (return 403 otherwise);
 *   3. `draft.tenant_id` must match the user's `agent_profiles.tenant_id`
 *      (return 403 otherwise) — defence-in-depth so a bug in (2) can't
 *      cross tenants.
 *
 * The caller passes the draft row it has already fetched (and, optionally,
 * the supabase admin client for the tenant lookup). The helper either
 * returns `{ ok: true, user, tenantId }` or returns `{ ok: false,
 * response: NextResponse }` carrying the right error status. Callers
 * then either continue with confidence or short-circuit by returning
 * `result.response` directly.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export type DraftAuthSuccess = {
  ok: true;
  user: User;
  tenantId: string;
};

export type DraftAuthFailure = {
  ok: false;
  response: NextResponse;
};

export type DraftAuthResult = DraftAuthSuccess | DraftAuthFailure;

interface DraftLike {
  user_id?: string | null;
  tenant_id?: string | null;
}

/**
 * Resolve and verify the authenticated user can mutate this draft.
 *
 * @param supabaseAdmin   Service-role client, used to look up the user's
 *                        tenant via `agent_profiles.tenant_id` keyed off
 *                        `user_id`.
 * @param authUser        Result of `supabaseAuth.auth.getUser()` —
 *                        `null` when no cookie was sent.
 * @param draft           The `pending_drafts` row the caller already
 *                        loaded. Carries `user_id` and `tenant_id`.
 */
export async function authorizeDraftMutation(
  supabaseAdmin: SupabaseClient,
  authUser: User | null | undefined,
  draft: DraftLike,
): Promise<DraftAuthResult> {
  if (!authUser) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      ),
    };
  }

  if (draft.user_id !== authUser.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  // Tenant-scoped check. agent_profiles.user_id matches auth.users.id;
  // we read tenant_id from the agent profile and compare it against the
  // draft's stored tenant_id. A mismatch can only happen via a bug
  // upstream (and is exactly the class of bug this guard exists to
  // catch), so we treat it as a 403 rather than papering over it.
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('agent_profiles')
    .select('tenant_id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (profileErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Failed to verify tenant' },
        { status: 500 },
      ),
    };
  }
  const tenantId = (profile as any)?.tenant_id as string | undefined;
  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No agent profile on file for this user' },
        { status: 403 },
      ),
    };
  }
  if (draft.tenant_id && draft.tenant_id !== tenantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, user: authUser, tenantId };
}
