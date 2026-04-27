import AgentShell from '../../../_components/AgentShell';

// Placeholder. Session 10 builds the real property detail page.
export default function LettingPropertyDetailPage({ params }: { params: { id: string } }) {
  return (
    <AgentShell>
      <div style={{ padding: 32, textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#0D0D12', margin: '0 0 8px' }}>
          Saved!
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Property ID: {params.id}</p>
      </div>
    </AgentShell>
  );
}
