'use client';

import AgentShell from '../../../../_components/AgentShell';
import LettingsComingSoon from '../../../_components/LettingsComingSoon';

/**
 * Placeholder for Session 8 — the full review form + save handler. Session 6
 * routes here from the Continue button on the lookup screen so we don't
 * 404 the magic-moment demo. The whole thing gets rebuilt in Session 8.
 */
export default function SavePropertyPlaceholderPage() {
  return (
    <AgentShell>
      <LettingsComingSoon
        title="Save"
        body="Coming in Session 8 — the full review form + save handler will live here."
      />
    </AgentShell>
  );
}
