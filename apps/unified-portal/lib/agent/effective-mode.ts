// Workspace mode resolution for the agent shell.
//
// `activeWorkspace.mode` (from AgentContext) is sticky — it reads from
// `agent_profiles.last_active_workspace_id` and only changes when the header
// switcher writes through `switchWorkspace()`. That left URL navigation out
// of sync: visiting /agent/pipeline/... while the persisted workspace was
// 'lettings' showed lettings tabs and the lettings header pill.
//
// `deriveEffectiveMode` resolves the mode the UI should display: the URL
// pathname wins when it unambiguously belongs to one workspace, and we fall
// back to the persisted workspace state for mode-neutral routes (intelligence,
// drafts, settings, dashboard, profile).

export type WorkspaceMode = 'sales' | 'lettings';

const SALES_PREFIXES = [
  '/agent/pipeline',
  '/agent/applicants',
  '/agent/viewings',
  '/agent/home',
  '/agent/enquiries',
  '/agent/contacts',
  '/agent/solicitors',
];

export function deriveEffectiveMode(
  pathname: string | null | undefined,
  fallback: WorkspaceMode | null | undefined,
): WorkspaceMode {
  const p = pathname || '';
  if (p.startsWith('/agent/lettings')) return 'lettings';
  if (SALES_PREFIXES.some((prefix) => p.startsWith(prefix))) return 'sales';
  return fallback ?? 'sales';
}
