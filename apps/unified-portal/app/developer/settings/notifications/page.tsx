/**
 * /developer/settings/notifications
 *
 * Sprint 3.5a tenant settings page for the aftercare email address.
 * Gated on FEATURE_HOMEOWNER_ISSUES (returns 404 when off) and on the
 * caller being an admin (returns 404 if not admin). The 404 path
 * matches the spec section 6.4 wording: snagger_external and other
 * non-admin roles should not even know this surface exists.
 */

import { notFound } from 'next/navigation';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, SnagAuthError } from '@/lib/assistant/snag-auth';
import { NotificationsSettingsClient } from './notifications-client';

export const dynamic = 'force-dynamic';

export default async function NotificationsSettingsPage() {
  if (!isHomeownerIssuesEnabled()) {
    notFound();
  }

  let auth;
  try {
    auth = await resolveSnagAuth();
  } catch (err) {
    if (err instanceof SnagAuthError) {
      notFound();
    }
    throw err;
  }
  if (auth.role !== 'admin') {
    notFound();
  }

  return <NotificationsSettingsClient />;
}
