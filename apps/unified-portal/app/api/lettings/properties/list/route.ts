import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/lettings/properties/list — returns the agent's lettings stock
 * with each property's active tenancy (tenant_name, rent_pcm, lease_end)
 * embedded for the list view. Two scoped queries + an .in() lookup join,
 * not N+1.
 */

const TENANTED_STATUSES = new Set(['let', 'occupied', 'tenanted']);

const EMPTY_RESPONSE = {
  properties: [] as unknown[],
  totalCount: 0,
  tenantedCount: 0,
  monthlyRentRoll: 0,
};

export async function GET() {
  const started = Date.now();
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json(EMPTY_RESPONSE);

    const { data: workspace } = await admin
      .from('agent_workspaces')
      .select('id')
      .eq('agent_id', agentProfile.id)
      .eq('mode', 'lettings')
      .limit(1)
      .maybeSingle();
    if (!workspace) return NextResponse.json(EMPTY_RESPONSE);

    console.log(`[lettings-properties-list] fetch_start agent=${agentProfile.id}`);

    const { data: rows, error } = await admin
      .from('agent_letting_properties')
      .select('id, address, address_line_1, city, eircode, status, completeness_score, created_at')
      .eq('agent_id', agentProfile.id)
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(`[lettings-properties-list] query_failed reason=${error.message}`);
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }

    const properties = rows ?? [];
    const tenancyByProperty = new Map<
      string,
      { tenant_name: string | null; rent_pcm: number | null; lease_end: string | null }
    >();
    if (properties.length > 0) {
      const ids = properties.map((p) => p.id);
      const { data: tenancies } = await admin
        .from('agent_tenancies')
        .select('letting_property_id, tenant_name, rent_pcm, lease_end')
        .eq('status', 'active')
        .in('letting_property_id', ids);
      for (const t of tenancies ?? []) {
        tenancyByProperty.set(t.letting_property_id, {
          tenant_name: t.tenant_name,
          rent_pcm: t.rent_pcm,
          lease_end: t.lease_end,
        });
      }
    }

    let tenantedCount = 0;
    let monthlyRentRoll = 0;
    const result = properties.map((p) => {
      const tenancy = tenancyByProperty.get(p.id) ?? null;
      if (TENANTED_STATUSES.has((p.status ?? '').toLowerCase())) tenantedCount += 1;
      if (tenancy?.rent_pcm != null) monthlyRentRoll += Number(tenancy.rent_pcm);
      return {
        id: p.id,
        address: p.address ?? p.address_line_1 ?? '',
        addressLine1: p.address_line_1 ?? null,
        city: p.city ?? null,
        eircode: p.eircode ?? null,
        status: p.status ?? '',
        completenessScore: p.completeness_score ?? 0,
        activeTenancy: tenancy
          ? {
              tenantName: tenancy.tenant_name,
              rentPcm: tenancy.rent_pcm,
              leaseEnd: tenancy.lease_end,
            }
          : null,
      };
    });

    console.log(
      `[lettings-properties-list] fetch_ok count=${result.length} tenanted=${tenantedCount} duration_ms=${Date.now() - started}`,
    );
    return NextResponse.json({
      properties: result,
      totalCount: result.length,
      tenantedCount,
      monthlyRentRoll,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[lettings-properties-list] error duration_ms=${Date.now() - started} reason=${message}`,
    );
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}
