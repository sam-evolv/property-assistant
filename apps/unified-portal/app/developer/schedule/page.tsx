/**
 * /developer/schedule
 *
 * Assistant V2 Sprint 4. Schedule and calendar surface for site
 * managers and snaggers. Server component that gates the route on
 * FEATURE_SCHEDULE and verifies the caller has a site_team_members
 * row in some tenant. Handoff to ScheduleClient for the calendar.
 *
 * Spec: docs/specs/assistant-v2-sprint-4.md section 6.
 */

import { notFound } from 'next/navigation';
import { isScheduleEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, SnagAuthError } from '@/lib/assistant/snag-auth';
import { SnagNoAccess } from '../../snag/SnagNoAccess';
import { ScheduleClient } from './ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function DeveloperSchedulePage() {
  if (!isScheduleEnabled()) notFound();

  let auth;
  try {
    auth = await resolveSnagAuth();
  } catch (err) {
    if (err instanceof SnagAuthError) {
      if (err.code === 'unauthenticated') {
        return <SnagNoAccess code="unauthenticated" />;
      }
      return <SnagNoAccess code={err.code} />;
    }
    throw err;
  }

  return (
    <ScheduleClient
      role={auth.role}
      userId={auth.userId}
      tenantId={auth.tenantId}
    />
  );
}
