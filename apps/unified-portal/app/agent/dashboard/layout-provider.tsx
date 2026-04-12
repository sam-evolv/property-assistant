'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { AgentDashboardSidebar } from './layout-sidebar';

export interface DashboardAgentProfile {
  id: string;
  display_name: string;
  agency_name: string;
  agent_type: 'scheme' | 'independent' | 'hybrid';
}

export interface DashboardDevelopment {
  id: string;
  name: string;
}

interface AgentDashboardContextType {
  profile: DashboardAgentProfile;
  developments: DashboardDevelopment[];
  selectedSchemeId: string | null;
  setSelectedSchemeId: (id: string | null) => void;
}

const AgentDashboardContext = createContext<AgentDashboardContextType | null>(null);

export function useAgentDashboard() {
  const ctx = useContext(AgentDashboardContext);
  if (!ctx) throw new Error('useAgentDashboard must be used within AgentDashboardLayoutProvider');
  return ctx;
}

export function AgentDashboardLayoutProvider({
  children,
  profile,
  developments,
}: {
  children: ReactNode;
  profile: DashboardAgentProfile;
  developments: DashboardDevelopment[];
}) {
  const [selectedSchemeId, setSelectedSchemeIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('agent_dashboard_scheme');
    if (stored && developments.some(d => d.id === stored)) {
      setSelectedSchemeIdState(stored);
    }
  }, [developments]);

  const setSelectedSchemeId = useCallback((id: string | null) => {
    setSelectedSchemeIdState(id);
    if (id) {
      localStorage.setItem('agent_dashboard_scheme', id);
    } else {
      localStorage.removeItem('agent_dashboard_scheme');
    }
  }, []);

  return (
    <AgentDashboardContext.Provider value={{ profile, developments, selectedSchemeId, setSelectedSchemeId }}>
      <div style={{
        display: 'flex',
        height: '100vh',
        background: '#f5f4f0',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}>
        <AgentDashboardSidebar />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {children}
        </main>
      </div>
    </AgentDashboardContext.Provider>
  );
}
