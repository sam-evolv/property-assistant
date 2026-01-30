import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { tenants, developments, admins } from '@openhouse/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(['super_admin']);

    const tenantsData = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        created_at: tenants.created_at,
      })
      .from(tenants)
      .orderBy(sql`${tenants.created_at} DESC`);

    const tenantIds = tenantsData.map(t => t.id);

    let developmentCounts: Record<string, number> = {};
    let adminCounts: Record<string, number> = {};

    if (tenantIds.length > 0) {
      const devCountsResult = await db
        .select({
          tenant_id: developments.tenant_id,
          count: count(),
        })
        .from(developments)
        .groupBy(developments.tenant_id);

      developmentCounts = devCountsResult.reduce((acc, row) => {
        if (row.tenant_id) {
          acc[row.tenant_id] = Number(row.count);
        }
        return acc;
      }, {} as Record<string, number>);

      const adminCountsResult = await db
        .select({
          tenant_id: admins.tenant_id,
          count: count(),
        })
        .from(admins)
        .groupBy(admins.tenant_id);

      adminCounts = adminCountsResult.reduce((acc, row) => {
        if (row.tenant_id) {
          acc[row.tenant_id] = Number(row.count);
        }
        return acc;
      }, {} as Record<string, number>);
    }

    const formattedTenants = tenantsData.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      created_at: tenant.created_at,
      _count: {
        developments: developmentCounts[tenant.id] || 0,
        admins: adminCounts[tenant.id] || 0,
      },
    }));

    return NextResponse.json({ 
      tenants: formattedTenants,
      total: formattedTenants.length,
    });
  } catch (error: any) {
    console.error('[Super Tenants API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(['super_admin']);

    const body = await request.json();
    const { name, slug } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const tenantSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const [newTenant] = await db
      .insert(tenants)
      .values({
        name,
        slug: tenantSlug,
      })
      .returning();

    return NextResponse.json({ tenant: newTenant }, { status: 201 });
  } catch (error: any) {
    console.error('[Super Tenants API] POST Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 });
  }
}
