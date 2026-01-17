export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db, tenants, developments } from '@openhouse/db';
import { sql, count } from 'drizzle-orm';

export async function GET() {
  try {
    // First, get all tenants
    const allTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        description: tenants.description,
        theme_color: tenants.theme_color,
        logo_url: tenants.logo_url,
        created_at: tenants.created_at,
      })
      .from(tenants)
      .orderBy(tenants.created_at);

    // Then, get development counts per tenant
    const devCounts = await db
      .select({
        tenant_id: developments.tenant_id,
        count: count(),
      })
      .from(developments)
      .groupBy(developments.tenant_id);

    // Build a lookup map
    const countMap: Record<string, number> = {};
    devCounts.forEach(row => {
      countMap[row.tenant_id] = Number(row.count);
    });

    // Combine results
    const result = allTenants.map(t => ({
      ...t,
      house_count: countMap[t.id] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}
