export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db, tenants, admins, developments, documents, pois, noticeboard_posts } from '@openhouse/db';
import { eq, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const [tenantAdmins, tenantDevelopments] = await Promise.all([
      db.select().from(admins).where(eq(admins.tenant_id, tenant.id)),
      db.select().from(developments).where(eq(developments.tenant_id, tenant.id)),
    ]);

    const [documentsCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(documents)
      .where(eq(documents.tenant_id, tenant.id));

    const [poisCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(pois)
      .where(eq(pois.tenant_id, tenant.id));

    const [noticeboardCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(noticeboard_posts)
      .where(eq(noticeboard_posts.tenant_id, tenant.id));

    return NextResponse.json({
      tenant,
      admins: tenantAdmins,
      developments: tenantDevelopments,
      documents_count: documentsCount?.count || 0,
      pois_count: poisCount?.count || 0,
      noticeboard_count: noticeboardCount?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant details' },
      { status: 500 }
    );
  }
}
