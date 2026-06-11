/**
 * /snag/import
 *
 * Upload an external snag list — any spreadsheet shape — and the AI
 * organises it into the canonical snag record. Same gating as /snag.
 */

import { redirect, notFound } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, SnagAuthError } from '@/lib/assistant/snag-auth';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { SnagNoAccess } from '../SnagNoAccess';
import { SnagImportClient } from './import-client';

export const dynamic = 'force-dynamic';

export default async function SnagImportPage() {
  if (!isBuilderSnagAppEnabled()) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirectTo=/snag/import');
  }

  try {
    await resolveSnagAuth();
  } catch (err) {
    if (err instanceof SnagAuthError) {
      return <SnagNoAccess code={err.code} />;
    }
    throw err;
  }

  return <SnagImportClient />;
}
