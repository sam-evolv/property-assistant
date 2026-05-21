/**
 * /developer/snaggers
 *
 * Assistant V2 Sprint 2. Admin invite UI. Lives inside the developer
 * sidebar layout so admins keep their nav when managing the snagging
 * team. The spec called this /admin/snaggers; Session 3 moved it to
 * /developer/snaggers for routing consistency.
 *
 * Server responsibilities:
 *   1. 404 if FEATURE_BUILDER_SNAG_APP is off.
 *   2. The /developer layout already gates on Supabase session.
 *   3. Resolve site_team_members and require role='admin'. Non-admins
 *      see the no-access screen.
 */

import { notFound } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, assertIsAdmin, SnagAuthError } from '@/lib/assistant/snag-auth';
import { SnagNoAccess } from '../../snag/SnagNoAccess';
import { SnaggersClient } from './SnaggersClient';

export const dynamic = 'force-dynamic';

export default async function DeveloperSnaggersPage() {
  if (!isBuilderSnagAppEnabled()) notFound();

  let auth;
  try {
    auth = await resolveSnagAuth();
    assertIsAdmin(auth);
  } catch (err) {
    if (err instanceof SnagAuthError) {
      return <SnagNoAccess code={err.code === 'unauthenticated' ? 'unauthenticated' : 'forbidden'} />;
    }
    throw err;
  }

  return <SnaggersClient tenantId={auth.tenantId} />;
}
