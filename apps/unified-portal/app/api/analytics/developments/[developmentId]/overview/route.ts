import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages, homeowners, developments } from '@openhouse/db/schema';
import { sql, eq } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: { developmentId: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { developmentId } = params;
    if (!UUID_RE.test(developmentId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify the development belongs to the caller's tenant (super_admin may
    // access any development).
    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: { id: true, tenant_id: true },
    });
    if (!development) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [msgCount, homeownerCount, msgGrowth] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(messages)
        .where(sql`${messages.development_id} = ${developmentId}`)
        .then(r => r[0]?.count || 0),
      
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(homeowners)
        .where(sql`${homeowners.development_id} = ${developmentId}`)
        .then(r => r[0]?.count || 0),
      
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(messages)
        .where(sql`${messages.development_id} = ${developmentId} AND ${messages.created_at} >= ${sevenDaysAgo}`)
        .then(r => r[0]?.count || 0),
    ]);

    const overview = {
      total_messages: msgCount,
      total_homeowners: homeownerCount,
      growth_7d: msgGrowth,
    };

    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch development overview' },
      { status: 500 }
    );
  }
}
