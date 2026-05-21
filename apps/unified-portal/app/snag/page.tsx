/**
 * /snag
 *
 * Assistant V2 Sprint 2. Phone-first snag capture form for site team
 * members and accepted external snaggers.
 *
 * Spec: docs/specs/assistant-v2-sprint-2.md section 7.
 *
 * Server responsibilities:
 *   1. 404 if FEATURE_BUILDER_SNAG_APP is off.
 *   2. Redirect to /login if no Supabase session.
 *   3. Resolve site_team_members membership; show no-access screen if
 *      none.
 *   4. Render the client form with the resolved auth context as initial
 *      props (so the form does not have to wait on an auth round trip
 *      before painting).
 */

import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, SnagAuthError } from '@/lib/assistant/snag-auth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { SnagFormClient } from './SnagFormClient';
import { SnagNoAccess } from './SnagNoAccess';

export const dynamic = 'force-dynamic';

export default async function SnagPage() {
  if (!isBuilderSnagAppEnabled()) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirectTo=/snag');
  }

  let auth;
  try {
    auth = await resolveSnagAuth();
  } catch (err) {
    if (err instanceof SnagAuthError) {
      return <SnagNoAccess code={err.code} />;
    }
    throw err;
  }

  return (
    <SnagFormClient
      initialAuth={{
        userId: auth.userId,
        email: auth.email,
        tenantId: auth.tenantId,
        role: auth.role,
        developmentIds: auth.developmentIds,
        isAdmin: auth.isAdmin,
      }}
    />
  );
}
