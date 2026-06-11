/**
 * /snag/houses/[unitId]
 *
 * One house, its whole snag list. Open and Done tabs, mark-off with
 * optional completion photos, capture pre-filled for this house.
 * Same gating as /snag.
 */

import { redirect, notFound } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { resolveSnagAuth, assertCanAccessDevelopment, SnagAuthError } from '@/lib/assistant/snag-auth';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import { SnagNoAccess } from '../../SnagNoAccess';
import { HouseClient } from './house-client';

export const dynamic = 'force-dynamic';

export default async function SnagHousePage({ params }: { params: { unitId: string } }) {
  if (!isBuilderSnagAppEnabled()) {
    notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirectTo=/snag/houses/${params.unitId}`);
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

  const admin = getSupabaseAdmin();
  const { data: unit } = await admin
    .from('units')
    .select('id, tenant_id, development_id, unit_number, address, address_line_1, handover_date')
    .eq('id', params.unitId)
    .maybeSingle();

  if (!unit || unit.tenant_id !== auth.tenantId) {
    notFound();
  }
  try {
    assertCanAccessDevelopment(auth, unit.development_id);
  } catch (err) {
    if (err instanceof SnagAuthError) {
      return <SnagNoAccess code={err.code} />;
    }
    throw err;
  }

  return (
    <HouseClient
      unit={{
        id: unit.id,
        developmentId: unit.development_id,
        label: unit.unit_number || unit.address || unit.address_line_1 || 'Unit',
        address: unit.address || unit.address_line_1 || null,
        handoverDate: unit.handover_date || null,
      }}
    />
  );
}
