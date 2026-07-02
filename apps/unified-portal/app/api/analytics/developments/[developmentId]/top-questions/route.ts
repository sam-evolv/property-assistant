import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { messages, developments } from '@openhouse/db/schema';
import { sql, eq } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: { developmentId: string } }
) {
  try {
    // Returns verbatim purchaser chat text for a single development.
    // Require a session and verify the development belongs to the caller's
    // tenant (super_admin may access any development).
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { developmentId } = params;
    if (!UUID_RE.test(developmentId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

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

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '10');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.select({
      question: sql<string>`SUBSTRING(${messages.content} FROM 1 FOR 100)`,
      count: sql<number>`COUNT(*)::int`,
    })
      .from(messages)
      .where(sql`${messages.development_id} = ${developmentId} AND ${messages.created_at} >= ${startDate} AND ${messages.sender} = 'user'`)
      .groupBy(sql`SUBSTRING(${messages.content} FROM 1 FOR 100)`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch development top questions' },
      { status: 500 }
    );
  }
}
