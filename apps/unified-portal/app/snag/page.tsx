/**
 * /snag — the snagging app's front door.
 *
 * House-first by design: you walk the estate, pick a house, snag it.
 * Capture lives at /snag/new (deep-linkable with ?development_id&unit_id).
 */

import { redirect, notFound } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

export default function SnagPage() {
  if (!isBuilderSnagAppEnabled()) {
    notFound();
  }
  redirect('/snag/houses');
}
