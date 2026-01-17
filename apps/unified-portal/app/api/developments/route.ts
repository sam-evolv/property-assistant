import { NextRequest, NextResponse } from 'next/server';
import { handleCreateDevelopment } from '@openhouse/api/developments';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments, tenants } from '@openhouse/db/schema';
import { sql, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const supabaseAdmin = getSupabaseAdmin();

    // Get optional tenant_id filter from query params
    const { searchParams } = new URL(request.url);
    const filterTenantId = searchParams.get('tenant_id');

    // For non-super_admin, always filter by their tenant
    const effectiveTenantId = session.role !== 'super_admin'
      ? session.tenantId
      : filterTenantId;

    console.log('[Developments API] Fetching developments...', {
      role: session.role,
      filterTenantId: effectiveTenantId
    });
    
    let drizzleDevs: any[] = [];
    let drizzleError: Error | null = null;

    // Build tenant lookup for names
    const tenantLookup: Record<string, string> = {};
    try {
      const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
      allTenants.forEach(t => { tenantLookup[t.id] = t.name; });
    } catch (err) {
      console.error('[Developments API] Failed to fetch tenants:', err);
    }

    try {
      // Build query with optional tenant filter
      if (effectiveTenantId) {
        drizzleDevs = await db
          .select()
          .from(developments)
          .where(eq(developments.tenant_id, effectiveTenantId))
          .orderBy(sql`created_at DESC`);
      } else {
        drizzleDevs = await db.select().from(developments).orderBy(sql`created_at DESC`);
      }
      console.log('[Developments API] Drizzle developments:', drizzleDevs.length);
    } catch (err) {
      drizzleError = err instanceof Error ? err : new Error('Drizzle query failed');
      console.error('[Developments API] Drizzle error (falling back to Supabase):', drizzleError.message);
    }

    // For Supabase projects, we need to match by organization_id if filtering
    let supabaseQuery = supabaseAdmin
      .from('projects')
      .select('id, name, address, image_url, organization_id, created_at');

    // Note: Supabase 'projects' table may use 'organization_id' which could map to tenant
    // For now, we'll include all and let the merge handle deduplication
    const supabaseResult = await supabaseQuery;

    console.log('[Developments API] Supabase projects:', supabaseResult.data?.length || 0);

    if (supabaseResult.error) {
      console.error('[Developments API] Supabase error:', supabaseResult.error);
    }

    const drizzleIds = new Set(drizzleDevs.map(d => d.id));

    const normalizedDrizzleDevs = drizzleDevs.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code || d.name?.toUpperCase().replace(/\s+/g, '_').substring(0, 10) || 'DEV',
      is_active: d.is_active ?? true,
      address: d.address || null,
      image_url: d.logo_url || null,
      tenant_id: d.tenant_id,
      tenant_name: tenantLookup[d.tenant_id] || 'Unknown',
      source: 'drizzle' as const,
    }));

    // Filter Supabase projects that aren't already in Drizzle, and optionally by tenant
    const supabaseProjects = (supabaseResult.data || [])
      .filter(p => !drizzleIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name || 'Unnamed Project',
        code: p.name?.toUpperCase().replace(/\s+/g, '_').substring(0, 10) || 'PROJ',
        is_active: true,
        address: p.address || null,
        image_url: p.image_url || null,
        tenant_id: p.organization_id || null, // Map organization_id to tenant_id
        tenant_name: p.organization_id ? (tenantLookup[p.organization_id] || 'Unknown') : 'Unassigned',
        source: 'supabase' as const,
      }))
      // If filtering by tenant, also filter Supabase projects
      .filter(p => !effectiveTenantId || p.tenant_id === effectiveTenantId);

    const allDevelopments = [...normalizedDrizzleDevs, ...supabaseProjects];
    
    // Fetch unit counts per development using aggregation
    const unitCounts: Record<string, { total: number; active: number }> = {};
    
    // Get total counts per project
    for (const dev of allDevelopments) {
      try {
        const { count: totalCount } = await supabaseAdmin
          .from('units')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', dev.id);
        
        const { count: activeCount } = await supabaseAdmin
          .from('units')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', dev.id)
          .not('purchaser_name', 'is', null);
        
        unitCounts[dev.id] = {
          total: totalCount || 0,
          active: activeCount || 0,
        };
      } catch (e) {
        console.log(`[Developments API] Failed to get unit counts for ${dev.id}`);
        unitCounts[dev.id] = { total: 0, active: 0 };
      }
    }
    
    const developmentsWithCounts = allDevelopments.map(dev => ({
      ...dev,
      unitCount: unitCounts[dev.id]?.total || 0,
      activeUnitCount: unitCounts[dev.id]?.active || 0,
    }));

    console.log('[Developments API] Total merged developments:', allDevelopments.length);

    // Include metadata about the query
    return NextResponse.json({
      success: true,
      developments: developmentsWithCounts,
      meta: {
        total: developmentsWithCounts.length,
        filtered_by_tenant: effectiveTenantId || null,
        user_role: session.role,
      }
    });
  } catch (error) {
    console.error('[Developments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch developments' },
      { status: 500 }
    );
  }
}

export const POST = handleCreateDevelopment;
