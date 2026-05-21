/**
 * GET /api/snag/developments
 *
 * Assistant V2 Sprint 2. Returns the developments the caller can access
 * for the snag form's development switcher.
 *
 * Scoping:
 *   - admin / site_team:  all developments in the caller's tenant
 *   - snagger_external:   restricted to development_ids on the
 *                         site_team_members row
 *
 * Gated on FEATURE_BUILDER_SNAG_APP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import {
  resolveSnagAuth,
  snagAuthErrorToResponse,
  snagFeatureDisabledResponse,
  SnagAuthError,
} from '@/lib/assistant/snag-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isBuilderSnagAppEnabled()) {
    return snagFeatureDisabledResponse();
  }

  let auth;
  try {
    auth = await resolveSnagAuth(request);
  } catch (err) {
    if (err instanceof SnagAuthError) return snagAuthErrorToResponse(err);
    throw err;
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('developments')
    .select('id, name, tenant_id, is_active')
    .eq('tenant_id', auth.tenantId)
    .order('name', { ascending: true });

  if (auth.role === 'snagger_external') {
    const scope = Array.isArray(auth.developmentIds) ? auth.developmentIds : [];
    if (scope.length === 0) {
      return NextResponse.json({ developments: [] });
    }
    query = query.in('id', scope);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[snag-developments] list_failed reason=%s', error.message);
    return NextResponse.json({ error: 'Could not load developments' }, { status: 500 });
  }

  return NextResponse.json({
    developments: (data ?? []).map((d) => ({
      id: d.id as string,
      name: (d.name as string) ?? 'Development',
      is_active: (d.is_active as boolean | null) ?? true,
    })),
    role: auth.role,
    is_admin: auth.isAdmin,
  });
}
