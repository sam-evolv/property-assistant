'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getAgentProfile,
  getAgentAssignments,
  getAgentPipelineAll,
  getAgentAlerts,
  getDevelopmentSummaries,
  type AgentProfile,
  type PipelineUnit,
  type Alert,
  type DevelopmentSummary,
} from './agentPipelineService';
import type { AgentWorkspace } from './workspaces';

interface AgentContextValue {
  agent: AgentProfile | null;
  pipeline: PipelineUnit[];
  alerts: Alert[];
  developments: DevelopmentSummary[];
  developmentIds: string[];
  workspaces: AgentWorkspace[];
  activeWorkspace: AgentWorkspace | null;
  switchWorkspace: (workspaceId: string) => Promise<{ destinationUrl: string }>;
  loading: boolean;
  error: string | null;
  refreshPipeline: () => Promise<void>;
}

const AgentContext = createContext<AgentContextValue>({
  agent: null,
  pipeline: [],
  alerts: [],
  developments: [],
  developmentIds: [],
  workspaces: [],
  activeWorkspace: null,
  switchWorkspace: async () => ({ destinationUrl: '/agent/home' }),
  loading: true,
  error: null,
  refreshPipeline: async () => {},
});

export function useAgent() {
  return useContext(AgentContext);
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const preview = searchParams.get('preview');

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [pipeline, setPipeline] = useState<PipelineUnit[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [developments, setDevelopments] = useState<DevelopmentSummary[]>([]);
  const [developmentIds, setDevelopmentIds] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<AgentWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<AgentWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/workspaces');
      if (!res.ok) return;
      const data = (await res.json()) as {
        workspaces: AgentWorkspace[];
        activeWorkspaceId: string | null;
      };
      const list = data.workspaces ?? [];
      setWorkspaces(list);
      const active = list.find((w) => w.id === data.activeWorkspaceId)
        ?? list.find((w) => w.isDefault)
        ?? list[0]
        ?? null;
      setActiveWorkspace(active);
    } catch {
      // Workspaces are not yet wired into prod auth; failure is non-fatal.
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Workspaces load independently of pipeline data.
      void loadWorkspaces();

      // Try the server-side API route first (uses service role, no RLS issues)
      try {
        const res = await fetch('/api/agent/pipeline-data');
        if (res.ok) {
          const data = await res.json();
          if (data.agent) {
            const profile: AgentProfile = data.agent;
            setAgent(profile);

            // Build a name lookup from the developments array (always populated by service role)
            const devNameLookup = new Map<string, string>();
            for (const d of data.developments || []) {
              devNameLookup.set(String(d.id), d.name);
            }

            // Enrich pipeline units with development names (defensive: fixes any Map key mismatch in API)
            const enrichedPipeline = (data.pipeline || []).map((p: PipelineUnit) => ({
              ...p,
              developmentName: p.developmentName || devNameLookup.get(String(p.developmentId)) || 'Unknown',
            }));
            setPipeline(enrichedPipeline);
            setDevelopmentIds((data.developments || []).map((d: any) => d.id));

            // Compute development summaries from enriched pipeline + API metadata
            const devSummaries = getDevelopmentSummaries(enrichedPipeline, data.developments || []);
            setDevelopments(devSummaries);
            setAlerts(data.alerts || []);
            setLoading(false);
            return;
          }
        }
      } catch {
        // API route failed, fall through to client-side
      }

      // Fallback: client-side Supabase (original approach)
      const profile = await getAgentProfile(preview || undefined);
      if (!profile) {
        setError('No agent profile found');
        setLoading(false);
        return;
      }
      setAgent(profile);

      const devIds = await getAgentAssignments(profile.id);
      setDevelopmentIds(devIds);

      // For scheme agents, no schemes = error. For independent/hybrid, it's fine.
      if (devIds.length === 0 && profile.agentType === 'scheme') {
        setError('No schemes assigned');
        setLoading(false);
        return;
      }

      if (devIds.length > 0) {
        // Load pipeline for ALL assigned developments
        const pipelineData = await getAgentPipelineAll(profile.id, devIds);
        setPipeline(pipelineData);

        // Compute development summaries
        const devSummaries = getDevelopmentSummaries(pipelineData);
        setDevelopments(devSummaries);

        // Compute alerts
        const alertData = getAgentAlerts(pipelineData);
        setAlerts(alertData);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [preview, loadWorkspaces]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const res = await fetch('/api/agent/workspaces/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error || `Failed to switch workspace (${res.status})`);
    }
    const data = (await res.json()) as { destinationUrl: string };
    const next = workspaces.find((w) => w.id === workspaceId) ?? null;
    if (next) setActiveWorkspace(next);
    return data;
  }, [workspaces]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshPipeline = useCallback(async () => {
    // Try API route first for refresh too
    try {
      const res = await fetch('/api/agent/pipeline-data');
      if (res.ok) {
        const data = await res.json();
        if (data.pipeline) {
          // Enrich with development names from the developments array
          const devNameLookup = new Map<string, string>();
          for (const d of data.developments || []) {
            devNameLookup.set(String(d.id), d.name);
          }
          const enrichedPipeline = (data.pipeline || []).map((p: PipelineUnit) => ({
            ...p,
            developmentName: p.developmentName || devNameLookup.get(String(p.developmentId)) || 'Unknown',
          }));
          setPipeline(enrichedPipeline);
          setDevelopments(getDevelopmentSummaries(enrichedPipeline, data.developments || []));
          setAlerts(data.alerts || []);
          return;
        }
      }
    } catch {
      // Fall through to client-side
    }

    if (!agent || developmentIds.length === 0) return;
    const pipelineData = await getAgentPipelineAll(agent.id, developmentIds);
    setPipeline(pipelineData);
    setDevelopments(getDevelopmentSummaries(pipelineData));
    setAlerts(getAgentAlerts(pipelineData));
  }, [agent, developmentIds]);

  return (
    <AgentContext.Provider value={{
      agent,
      pipeline,
      alerts,
      developments,
      developmentIds,
      workspaces,
      activeWorkspace,
      switchWorkspace,
      loading,
      error,
      refreshPipeline,
    }}>
      {children}
    </AgentContext.Provider>
  );
}
