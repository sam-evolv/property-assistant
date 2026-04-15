'use client';

import { createContext, useContext, ReactNode } from 'react';
import { AgentDashboardSidebar } from './layout-sidebar';

/** Dashboard-layer profile (snake_case from Supabase row). */
export interface DashboardAgentProfile {
  id: string;
  display_name: string;
  agency_name: string;
  agent_type: 'scheme' | 'independent' | 'hybrid';
}

interface AgentDashboardContextType {
  profile: DashboardAgentProfile;
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
}: {
  children: ReactNode;
  profile: DashboardAgentProfile;
}) {
  return (
    <AgentDashboardContext.Provider value={{ profile }}>
      <div style={{
        display: 'flex',
        height: '100vh',
        background: '#FAFAF8',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}>
        <AgentDashboardSidebar profile={profile} />
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
