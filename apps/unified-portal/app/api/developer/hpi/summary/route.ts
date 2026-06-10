import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { rollupHpiEvidence } from '@/lib/dev-app/hpi-rollup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/developer/hpi/summary
 *
 * HPI QA 8.0 readiness rollup for the developer portal, scoped like the rest
 * of /developer (same model as /api/pipeline): super_admin sees every
 * development, everyone else is tenant-scoped via their admin session. The
 * dev-app variant (/api/dev-app/hpi/summary) keeps the developer_user_id
 * ownership model for the mobile surface; both share the same rollup.
 */
export async function GET(_request: NextRequest) {
  try {
    let session;
    try {
      session = await requireRole(['developer', 'admin', 'super_admin']);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdmin = session.role === 'super_admin';
    if (!session.tenantId && !isSuperAdmin) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    let devQuery = admin
      .from('developments')
      .select('id, name')
      .order('name', { ascending: true });
    if (!isSuperAdmin) {
      devQuery = devQuery.eq('tenant_id', session.tenantId);
    }
    const { data: devs, error: devError } = await devQuery;
    if (devError) {
      return NextResponse.json({ error: 'Failed to load developments' }, { status: 500 });
    }

    const devList = (devs ?? []) as Array<{ id: string; name: string }>;
    if (devList.length === 0) return NextResponse.json({ developments: [] });

    const { data: units, error: unitError } = await admin
      .from('units')
      .select('id, unit_number, address_line_1, purchaser_name, development_id')
      .in('development_id', devList.map((d) => d.id))
      .order('unit_number');
    if (unitError) {
      return NextResponse.json({ error: 'Failed to load units' }, { status: 500 });
    }

    const developments = await rollupHpiEvidence(admin, devList, (units ?? []) as any[]);
    return NextResponse.json({ developments });
  } catch (error) {
    console.error('[Developer HPI] summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
