'use client';

import AgentShell from '../../_components/AgentShell';
import LettingsComingSoon from '../_components/LettingsComingSoon';

export default function LettingsViewingsPage() {
  return (
    <AgentShell>
      <LettingsComingSoon
        title="Viewings"
        body="Coming soon — scheduled viewings will appear here."
      />
    </AgentShell>
  );
}
