export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db, tenants, developments } from '@openhouse/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        description: tenants.description,
        theme_color: tenants.theme_color,
        logo_url: tenants.logo_url,
        created_at: tenants.created_at,
        house_count: sql<number>`(
          SELECT COUNT(*)::int 
          FROM ${developments} 
          WHERE ${developments.tenant_id} = ${tenants.id}
        )`,
      })
      .from(tenants)
      .orderBy(tenants.created_at);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}
