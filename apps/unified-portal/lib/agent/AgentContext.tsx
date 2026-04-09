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

interface AgentContextValue {
  agent: AgentProfile | null;
  pipeline: PipelineUnit[];
  alerts: Alert[];
  developments: DevelopmentSummary[];
  developmentIds: string[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

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
  }, [preview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshPipeline = useCallback(async () => {
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
      loading,
      error,
      refreshPipeline,
    }}>
      {children}
    </AgentContext.Provider>
  );
}
