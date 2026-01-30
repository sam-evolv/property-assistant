import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments, tenants, units } from '@openhouse/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(['super_admin']);

    const developmentsData = await db
      .select({
        id: developments.id,
        name: developments.name,
        address: developments.address,
        is_active: developments.is_active,
        created_at: developments.created_at,
        tenant_id: developments.tenant_id,
        tenant_name: tenants.name,
      })
      .from(developments)
      .leftJoin(tenants, eq(developments.tenant_id, tenants.id))
      .orderBy(sql`${developments.created_at} DESC`);

    let unitCounts: Record<string, number> = {};

    if (developmentsData.length > 0) {
      try {
        const unitCountsResult = await db
          .select({
            development_id: units.development_id,
            count: count(),
          })
          .from(units)
          .groupBy(units.development_id);

        unitCounts = unitCountsResult.reduce((acc, row) => {
          if (row.development_id) {
            acc[row.development_id] = Number(row.count);
          }
          return acc;
        }, {} as Record<string, number>);
      } catch (unitError) {
        console.log('[Super Developments API] Units table query failed, using 0 counts');
      }
    }

    const formattedDevelopments = developmentsData.map(dev => ({
      id: dev.id,
      name: dev.name,
      address: dev.address,
      is_active: dev.is_active,
      created_at: dev.created_at,
      tenant: dev.tenant_id ? {
        id: dev.tenant_id,
        name: dev.tenant_name || 'Unknown',
      } : null,
      _count: {
        units: unitCounts[dev.id] || 0,
        homeowners: 0,
      },
    }));

    return NextResponse.json({ 
      developments: formattedDevelopments,
      total: formattedDevelopments.length,
    });
  } catch (error: any) {
    console.error('[Super Developments API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch developments' }, { status: 500 });
  }
}
