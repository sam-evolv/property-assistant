import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Workspaces data layer (server-only).
 *
 * One agent_profile owns one or more workspaces. Each workspace is either a
 * sales workspace (powered by the existing developments/units schema) or a
 * lettings workspace (powered by agent_letting_properties / agent_tenancies).
 *
 * The API routes in app/api/agent/workspaces/ are the only callers — keep
 * this module server-only so service-role credentials never reach the bundle.
 *
 * Per the Session 2 architectural notes: setActiveWorkspace returns the
 * destination URL but does NOT navigate. Navigation is the caller's call.
 */

export type WorkspaceMode = 'sales' | 'lettings';

export type AgentWorkspace = {
  id: string;
  mode: WorkspaceMode;
  displayName: string;
  isDefault: boolean;
};

const SALES_HOME = '/agent/home';
const LETTINGS_HOME = '/agent/lettings/home';

export function workspaceDestinationUrl(mode: WorkspaceMode): string {
  return mode === 'lettings' ? LETTINGS_HOME : SALES_HOME;
}

export async function getAgentWorkspaces(agentId: string): Promise<AgentWorkspace[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('agent_workspaces')
    .select('id, mode, display_name, is_default')
    .eq('agent_id', agentId)
    .order('is_default', { ascending: false })
    .order('mode', { ascending: true });

  if (error) {
    throw new Error(`[workspaces] getAgentWorkspaces failed: ${error.message}`);
  }

  return (data ?? []).map(rowToWorkspace);
}

export async function getActiveWorkspace(agentId: string): Promise<AgentWorkspace | null> {
  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileErr } = await supabase
    .from('agent_profiles')
    .select('last_active_workspace_id')
    .eq('id', agentId)
    .maybeSingle();

  if (profileErr) {
    throw new Error(`[workspaces] getActiveWorkspace profile fetch failed: ${profileErr.message}`);
  }

  const workspaces = await getAgentWorkspaces(agentId);
  if (workspaces.length === 0) return null;

  const lastActiveId = profile?.last_active_workspace_id ?? null;
  if (lastActiveId) {
    const found = workspaces.find((w) => w.id === lastActiveId);
    if (found) return found;
  }

  return workspaces.find((w) => w.isDefault) ?? workspaces[0];
}

/**
 * Updates agent_profiles.last_active_workspace_id and returns the destination
 * URL for the new workspace. Caller decides whether to navigate.
 *
 * Throws WORKSPACE_NOT_FOUND if the workspace doesn't exist, or
 * WORKSPACE_OWNERSHIP_MISMATCH if the workspace doesn't belong to this agent.
 * The API route catches these and returns 403.
 *
 * Service role bypasses RLS so this validation is the only thing standing
 * between an agent and someone else's workspace pointer.
 */
export async function setActiveWorkspace(
  agentId: string,
  workspaceId: string,
): Promise<{ destinationUrl: string }> {
  const supabase = getSupabaseAdmin();

  const { data: workspace, error: wsErr } = await supabase
    .from('agent_workspaces')
    .select('id, mode, agent_id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (wsErr) {
    throw new Error(`[workspaces] setActiveWorkspace lookup failed: ${wsErr.message}`);
  }
  if (!workspace) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }
  if (workspace.agent_id !== agentId) {
    throw new Error('WORKSPACE_OWNERSHIP_MISMATCH');
  }

  const { error: updateErr } = await supabase
    .from('agent_profiles')
    .update({
      last_active_workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  if (updateErr) {
    throw new Error(`[workspaces] setActiveWorkspace update failed: ${updateErr.message}`);
  }

  return { destinationUrl: workspaceDestinationUrl(workspace.mode as WorkspaceMode) };
}

function rowToWorkspace(row: {
  id: string;
  mode: string;
  display_name: string;
  is_default: boolean | null;
}): AgentWorkspace {
  return {
    id: row.id,
    mode: row.mode as WorkspaceMode,
    displayName: row.display_name,
    isDefault: !!row.is_default,
  };
}
