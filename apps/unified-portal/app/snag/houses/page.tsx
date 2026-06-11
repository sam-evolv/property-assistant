/**
 * /snag/houses
 *
 * The Houses screen of the snagging app: walk a development house by
 * house. Houses closest to handover come first. Same gating as /snag.
 */

import { redirect, notFound } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, SnagAuthError } from '@/lib/assistant/snag-auth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { SnagNoAccess } from '../SnagNoAccess';
import { HousesClient } from './houses-client';

export const dynamic = 'force-dynamic';

export default async function SnagHousesPage() {
  if (!isBuilderSnagAppEnabled()) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirectTo=/snag/houses');
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

  return <HousesClient initialDevelopmentIds={auth.developmentIds ?? []} />;
}
