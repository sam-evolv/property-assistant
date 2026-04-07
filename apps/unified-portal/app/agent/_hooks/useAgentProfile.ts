import { useAgent } from '@/lib/agent/AgentContext';
import type { AgentType } from '@/lib/agent/agentPipelineService';

/**
 * Convenience hook for checking agent type and conditionally showing
 * independent vs scheme features.
 */
export function useAgentProfile() {
  const { agent, loading } = useAgent();

  const agentType: AgentType = agent?.agentType || 'scheme';
  const isIndependent = agentType !== 'scheme';
  const isScheme = agentType === 'scheme';

  return {
    profile: agent,
    loading,
    agentType,
    isIndependent,
    isScheme,
  };
}
