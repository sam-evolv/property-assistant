'use client';

import { ReactNode } from 'react';
import StatusBar from './StatusBar';
import BottomNav from './BottomNav';

interface AgentShellProps {
  children: ReactNode;
  agentName?: string;
  urgentCount?: number;
}

export default function AgentShell({
  children,
  agentName,
  urgentCount,
}: AgentShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: '#FAFAF8',
        overflow: 'visible',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <StatusBar agentName={agentName} urgentCount={urgentCount} />
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
