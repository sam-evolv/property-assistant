'use client';

import AgentShell from '../../../_components/AgentShell';

export default function NewWorkspacePlaceholderPage() {
  return (
    <AgentShell>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'rgba(212,175,55,0.10)',
            border: '0.5px solid rgba(212,175,55,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C49B2A"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>

        <h1
          style={{
            color: '#0D0D12',
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            margin: '0 0 8px',
          }}
        >
          Workspace creation coming soon
        </h1>
        <p
          style={{
            color: '#6B7280',
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 320,
          }}
        >
          Contact support to add a workspace.
        </p>
      </div>
    </AgentShell>
  );
}
