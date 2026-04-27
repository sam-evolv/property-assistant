'use client';

import AgentShell from '../../_components/AgentShell';
import LettingsComingSoon from '../_components/LettingsComingSoon';

export default function LettingsMaintenancePage() {
  return (
    <AgentShell>
      <LettingsComingSoon
        title="Maintenance"
        body="Coming soon — open maintenance tickets will appear here."
      />
    </AgentShell>
  );
}
