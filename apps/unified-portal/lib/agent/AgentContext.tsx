'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getAgentProfile,
  getAgentAssignments,
  getAgentPipeline,
  getAgentAlerts,
  type AgentProfile,
  type PipelineUnit,
  type Alert,
} from './agentPipelineService';

interface AgentContextValue {
  agent: AgentProfile | null;
  pipeline: PipelineUnit[];
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  developmentId: string | null;
  developmentName: string | null;
  refreshPipeline: () => Promise<void>;
}

const AgentContext = createContext<AgentContextValue>({
  agent: null,
  pipeline: [],
  alerts: [],
  loading: true,
  error: null,
  developmentId: null,
  developmentName: null,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [developmentId, setDevelopmentId] = useState<string | null>(null);
  const [developmentName, setDevelopmentName] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get agent profile
      const profile = await getAgentProfile(preview || undefined);
      if (!profile) {
        setError('No agent profile found');
        setLoading(false);
        return;
      }
      setAgent(profile);

      // Get assigned developments
      const devIds = await getAgentAssignments(profile.id);
      if (devIds.length === 0) {
        setError('No schemes assigned');
        setLoading(false);
        return;
      }

      // Load pipeline for first development (Riverside Gardens for Savills)
      const devId = devIds[0];
      setDevelopmentId(devId);

      const pipelineData = await getAgentPipeline(profile.id, devId);
      setPipeline(pipelineData);

      if (pipelineData.length > 0) {
        setDevelopmentName(pipelineData[0].developmentName);
      }

      // Compute alerts
      const alertData = getAgentAlerts(pipelineData);
      setAlerts(alertData);

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
    if (!agent || !developmentId) return;
    const pipelineData = await getAgentPipeline(agent.id, developmentId);
    setPipeline(pipelineData);
    const alertData = getAgentAlerts(pipelineData);
    setAlerts(alertData);
  }, [agent, developmentId]);

  return (
    <AgentContext.Provider value={{
      agent,
      pipeline,
      alerts,
      loading,
      error,
      developmentId,
      developmentName,
      refreshPipeline,
    }}>
      {children}
    </AgentContext.Provider>
  );
}
