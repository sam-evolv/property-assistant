import { NextRequest, NextResponse } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';

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
    const adminContext = await getAdminContextFromSession();
    
    if (!adminContext) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tenantId, role } = adminContext;
    
    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant context required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    console.log('[Developer Developments API] Fetching for tenant:', tenantId, 'role:', role);

    let drizzleDevs: any[] = [];
    try {
      drizzleDevs = await db.select({
        id: developments.id,
        name: developments.name,
        code: developments.code,
        slug: developments.slug,
        address: developments.address,
        archive_mode: developments.archive_mode,
        is_active: developments.is_active,
        created_at: developments.created_at,
      })
        .from(developments)
        .where(eq(developments.tenant_id, tenantId))
        .orderBy(sql`name ASC`);
      console.log('[Developer Developments API] Drizzle:', drizzleDevs.length);
    } catch (drizzleErr) {
      console.warn('[Developer Developments API] Drizzle fetch failed (falling back to Supabase):', 
        drizzleErr instanceof Error ? drizzleErr.message : 'Unknown error');
    }

    // Query ALL projects from Supabase (organization_id filter was causing 0 results)
    // Projects may not have organization_id set, so we fetch all and the user can see all available
    const supabaseResult = await supabaseAdmin
      .from('projects')
      .select('id, name, address, organization_id, created_at')
      .order('name', { ascending: true });

    console.log('[Developer Developments API] Supabase projects found:', supabaseResult.data?.length || 0);

    if (supabaseResult.error) {
      console.warn('[Developer Developments API] Supabase fetch failed (non-blocking):', supabaseResult.error.message);
    }

    const drizzleIds = new Set(drizzleDevs.map(d => d.id));

    const normalizedDrizzleDevs = drizzleDevs.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code || '',
      slug: d.slug || '',
      address: d.address || null,
      archive_mode: d.archive_mode || 'shared',
      is_active: d.is_active ?? true,
      source: 'drizzle' as const,
    }));

    const supabaseProjects = (supabaseResult.data || [])
      .filter(p => !drizzleIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name || 'Unnamed Project',
        code: '',
        slug: '',
        address: p.address || null,
        archive_mode: 'shared' as const,
        is_active: true,
        source: 'supabase' as const,
      }));

    const allDevelopments = [...normalizedDrizzleDevs, ...supabaseProjects];

    console.log('[Developer Developments API] Total:', allDevelopments.length);

    return NextResponse.json({
      success: true,
      developments: allDevelopments,
      count: allDevelopments.length,
    });
  } catch (error) {
    console.error('[Developer Developments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch developments' },
      { status: 500 }
    );
  }
}
