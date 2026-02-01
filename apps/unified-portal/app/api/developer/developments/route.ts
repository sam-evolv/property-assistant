import { NextRequest, NextResponse } from 'next/server';
import { getAdminContextFromSession } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    console.log('[Developer Developments API] Fetching for tenant:', tenantId, 'role:', role);

    let drizzleDevs: any[] = [];
    try {
      drizzleDevs = await db.select({
        id: developments.id,
        name: developments.name,
        code: developments.code,
        slug: developments.slug,
        address: developments.address,
        is_active: developments.is_active,
        created_at: developments.created_at,
      })
        .from(developments)
        .where(eq(developments.tenant_id, tenantId))
        .orderBy(sql`name ASC`);
      console.log('[Developer Developments API] Drizzle:', drizzleDevs.length);
    } catch (drizzleErr) {
      console.warn('[Developer Developments API] Drizzle fetch failed:', 
        drizzleErr instanceof Error ? drizzleErr.message : 'Unknown error');
    }

    // SECURITY: Only return developments from Drizzle that are properly tenant-filtered
    // Do NOT merge Supabase projects as they may belong to other tenants
    // The Drizzle query already filters by tenant_id which is the authoritative source
    
    const normalizedDrizzleDevs = drizzleDevs.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code || '',
      slug: d.slug || '',
      address: d.address || null,
      archive_mode: 'shared' as const,
      is_active: d.is_active ?? true,
      source: 'drizzle' as const,
    }));

    // Only use tenant-isolated developments from Drizzle
    const allDevelopments = normalizedDrizzleDevs;

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
