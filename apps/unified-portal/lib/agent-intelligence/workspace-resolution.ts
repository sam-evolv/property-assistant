/**
 * Workspace resolution for the drafts pipeline.
 *
 * Every read path that hits pending_drafts goes through resolveSessionWorkspace,
 * and every write path goes through resolveWriteWorkspace. Both return the
 * concrete agent_workspaces.id the draft is being read from / written into.
 *
 * Why a dedicated helper instead of stuffing the lookup into each route:
 *   1. The read path's "session workspace" depends on a `mode` query param
 *      OR the agent's persisted last_active_workspace_id. One source of
 *      truth keeps the drafts list, the count badge, and the deep-link
 *      route in lockstep.
 *   2. The write path needs the same lookup at the moment a draft is
 *      persisted (chat route, execute-actions route, broadcast, voice
 *      capture, drawer-store skill registry) so the workspace_id is
 *      stamped at creation from the active session, never inferred later
 *      from the originating record.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkspaceMode = 'sales' | 'lettings';

export interface ResolvedSessionWorkspace {
  workspaceId: string;
  mode: WorkspaceMode;
  agentProfileId: string;
  tenantId: string | null;
}

/**
 * Resolve the workspace the current request should read drafts from.
 *
 * Order of resolution:
 *   1. Explicit `mode` argument from the URL query — sales/lettings sub-
 *      pages always pass this through deriveEffectiveMode.
 *   2. agent_profiles.last_active_workspace_id — the persisted pick from
 *      the header workspace switcher, used on mode-neutral pages
 *      (/agent/drafts, /agent/home, /agent/intelligence).
 *   3. The agent's default workspace as a final fallback so a
 *      misconfigured client can't silently leak across workspaces.
 *
 * Returns null when no workspace can be resolved (no agent profile, no
 * workspaces seeded yet). Callers MUST treat null as "no drafts to show",
 * never as "show everything".
 */
export async function resolveSessionWorkspace(
  supabase: SupabaseClient,
  authUserId: string,
  modeHint: WorkspaceMode | null,
): Promise<ResolvedSessionWorkspace | null> {
  const { data: profile, error: profileErr } = await supabase
    .from('agent_profiles')
    .select('id, tenant_id, last_active_workspace_id')
    .eq('user_id', authUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;

  const { data: workspaces, error: wsErr } = await supabase
    .from('agent_workspaces')
    .select('id, mode, is_default')
    .eq('agent_id', profile.id);

  if (wsErr || !workspaces || workspaces.length === 0) return null;

  // If the URL says lettings/sales explicitly, that wins. The header
  // pill's persisted pick is only the fallback for mode-neutral routes.
  let chosen = modeHint
    ? workspaces.find((w: any) => w.mode === modeHint)
    : workspaces.find((w: any) => w.id === profile.last_active_workspace_id);

  if (!chosen) {
    chosen = workspaces.find((w: any) => w.is_default) ?? workspaces[0];
  }

  if (!chosen) return null;

  return {
    workspaceId: chosen.id,
    mode: chosen.mode as WorkspaceMode,
    agentProfileId: profile.id,
    tenantId: profile.tenant_id ?? null,
  };
}

/**
 * Resolve the workspace a new draft should be written into.
 *
 * Called from every write path so workspace_id is stamped at creation
 * from the active session, never inferred from the originating record.
 *
 * The `mode` argument comes from the chat route's body param (the client
 * passes the active workspace's mode through), the execute-actions
 * route's body, etc. Throws when no workspace matches — that's an upstream
 * bug (e.g. seeding) and we'd rather fail loudly than write a NULL
 * workspace_id and have it flagged for manual review.
 */
export async function resolveWriteWorkspace(
  supabase: SupabaseClient,
  authUserId: string,
  mode: WorkspaceMode,
): Promise<string> {
  const resolved = await resolveSessionWorkspace(supabase, authUserId, mode);
  if (!resolved) {
    throw new Error(
      `[workspace-resolution] No ${mode} workspace for user ${authUserId}. ` +
      `Drafts cannot be written without a workspace.`,
    );
  }
  if (resolved.mode !== mode) {
    // resolveSessionWorkspace falls back to the default workspace when
    // the requested mode isn't found. Write paths can't tolerate that
    // fallback — a lettings draft written into the sales workspace is
    // exactly the bleed we're fixing.
    throw new Error(
      `[workspace-resolution] User ${authUserId} has no workspace with mode=${mode}; ` +
      `resolver returned ${resolved.mode} instead. Refusing to write.`,
    );
  }
  return resolved.workspaceId;
}

/**
 * Server-side tripwire used by the drafts list endpoint and the
 * by-id endpoint. Every row returned from a workspace-scoped query
 * MUST already have workspace_id === sessionWorkspaceId; if not, the
 * SQL filter or RLS policy regressed and we throw rather than silently
 * filter. Filtering hides the bug; throwing surfaces it the next time
 * the request runs.
 */
export function assertDraftWorkspace<T extends { id: string; workspace_id: string | null }>(
  rows: T[],
  sessionWorkspaceId: string,
): void {
  for (const row of rows) {
    if (row.workspace_id !== sessionWorkspaceId) {
      throw new Error(
        `[drafts] Tripwire: draft ${row.id} has workspace_id=${row.workspace_id ?? 'null'} ` +
        `but session workspace is ${sessionWorkspaceId}. Cross-workspace leak detected.`,
      );
    }
  }
}
